import "server-only";
import { isExactPublicOrigin } from "../httpBoundary";

import { createHmac } from "node:crypto";

import {
  assertExactObjectKeys,
  readBoundedJsonObject,
  ticketWalletPrivateHeaders,
  validateTicketWalletBrowserRequest,
  WALLET_COOKIE,
} from "./ticketWalletHttp";
import {
  createTicketAuthDigest,
  type TicketAuthKeyring,
} from "./ticketAuthCrypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const IDEMPOTENCY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ADMISSION_CHALLENGE_LIFETIME_MS = 300_000;

type WalletAuthorityCommand = Readonly<{
  sessionId: string;
  tokenVerifier: string;
}>;

export type TicketAdmissionReadinessResult =
  | Readonly<{
    action: "read";
    state: "not_open" | "open" | "closed" | "fresh_auth_required" | "feature_unavailable" | "manager_recovery";
    serverNow: string;
    eventSessionId: string | null;
    opensAt: string | null;
    closesAt: string | null;
    maximumSelection: number;
  }>
  | Readonly<{ action: "unauthenticated" }>;

export type TicketAdmissionPreparedResult =
  | Readonly<{
    action: "prepared";
    operationId: string;
    eventSessionId: string;
    eventTitle: string;
    eventDate: string;
    selectedCount: number;
    challengeExpiresAt: string;
    serverNow?: string;
    expectedVersion: number;
  }>
  | Readonly<{
    action: "reused";
    operationId: string;
    eventSessionId: string;
    eventTitle: string;
    eventDate: string;
    selectedCount: number;
    challengeExpiresAt: string;
    serverNow?: string;
    expectedVersion: number;
  }>
  | Readonly<{
    action: "unauthenticated" | "conflict" | "rejected";
    reason?: string;
  }>;

export type TicketAdmissionResult =
  | Readonly<{
    action: "result";
    operationId: string;
    state: "pending" | "committed" | "already_committed" | "rejected";
    eventTitle: string;
    eventDate: string;
    admittedCount: number;
    admittedAt: string | null;
    serverNow: string;
    errorCode?: string;
  }>
  | Readonly<{
    action: "unauthenticated" | "not_found" | "conflict" | "rejected";
    reason?: string;
  }>;

export interface TicketAdmissionPublicRepository {
  readReadiness(command: Readonly<{
    environment: "test" | "live";
    session: WalletAuthorityCommand;
    eventSessionId: string | null;
  }>): Promise<TicketAdmissionReadinessResult>;
  prepare(command: Readonly<{
    environment: "test" | "live";
    session: WalletAuthorityCommand;
    admissionIds: readonly string[];
    prepareIdempotencyKeyHash: string;
    requestHash: string;
    challengeTokenVerifier: string;
  }>): Promise<
    TicketAdmissionPreparedResult
    | Extract<TicketAdmissionResult, { action: "result" }>
  >;
  commit(command: Readonly<{
    environment: "test" | "live";
    session: WalletAuthorityCommand;
    operationId: string;
    commitIdempotencyKeyHash: string;
    commitRequestHash: string;
    challengeTokenVerifier: string | null;
  }>): Promise<TicketAdmissionResult>;
  readResult(command: Readonly<{
    environment: "test" | "live";
    session: WalletAuthorityCommand;
    operationId: string;
  }>): Promise<TicketAdmissionResult>;
}

type TicketAdmissionPublicApiDependencies = Readonly<{
  repository: TicketAdmissionPublicRepository;
  keyring: TicketAuthKeyring;
  environment: "test" | "live";
  expectedOrigin: string;
  readiness(): Readonly<{ prepare: boolean; commit: boolean; resultRead: boolean }>;
  now?: () => number;
  /** Test seam. Production derives a stable token from session + idempotency authority. */
  randomToken?: () => string | undefined;
}>;

export function createTicketAdmissionPublicApi(
  dependencies: TicketAdmissionPublicApiDependencies,
) {
  const now = dependencies.now ?? Date.now;
  return {
    async readReadiness(request: Request) {
      const requestId = crypto.randomUUID();
      try {
        if (!dependencies.readiness().resultRead) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        if (!validateSafeBrowserRequest(request, dependencies.expectedOrigin)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const authority = requireWalletAuthority(request, dependencies.keyring);
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].some((key) => key !== "eventSessionId")) {
          throw new PublicAdmissionRequestError();
        }
        const eventSessionValues = url.searchParams.getAll("eventSessionId");
        if (eventSessionValues.length > 1) throw new PublicAdmissionRequestError();
        const eventSessionId = eventSessionValues[0] ?? null;
        if (eventSessionId !== null && !UUID_PATTERN.test(eventSessionId)) {
          throw new PublicAdmissionRequestError();
        }
        const result = await dependencies.repository.readReadiness({
          environment: dependencies.environment,
          session: walletAuthorityCommand(authority, dependencies.keyring),
          eventSessionId,
        });
        if (result.action === "unauthenticated") {
          return errorResponse("session_expired", 401, requestId);
        }
        return successResponse(projectReadiness(result), requestId);
      } catch (error) {
        return isPublicError(error)
          ? errorResponse("invalid_request", 400, requestId)
          : errorResponse("server_error", 500, requestId);
      }
    },

    async prepare(request: Request) {
      const requestId = crypto.randomUUID();
      try {
        if (!dependencies.readiness().prepare) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        const authority = requireWalletAuthority(request, dependencies.keyring);
        if (!validateMutation(request, dependencies.expectedOrigin, authority.csrf)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const idempotencyKey = requireIdempotencyKey(request);
        const body = await readBoundedJsonObject(request, 2_048);
        assertExactObjectKeys(body, ["admissionIds"]);
        const admissionIds = readAdmissionIds(body.admissionIds);
        const challengeToken = requireToken(
          dependencies.randomToken?.()
          ?? deriveStableChallengeToken(authority.token, idempotencyKey),
        );
        const result = await dependencies.repository.prepare({
          environment: dependencies.environment,
          session: walletAuthorityCommand(authority, dependencies.keyring),
          admissionIds,
          prepareIdempotencyKeyHash: createTicketAuthDigest(
            dependencies.keyring,
            "admission-prepare-idempotency",
            `${authority.id}:${idempotencyKey}`,
          ),
          requestHash: createTicketAuthDigest(
            dependencies.keyring,
            "admission-request",
            `prepare:${authority.id}:${admissionIds.join(",")}`,
          ),
          challengeTokenVerifier: createTicketAuthDigest(
            dependencies.keyring,
            "admission-challenge",
            challengeToken,
          ),
        });
        if (result.action === "result") {
          return successResponse(projectResult(result), requestId);
        }
        if (result.action !== "prepared" && result.action !== "reused") {
          return admissionFailure(result, requestId);
        }
        const projected = projectPrepared(result, now());
        const headers = responseHeaders(requestId);
        headers.append("set-cookie", serializeChallengeCookie(
          result.operationId,
          challengeToken,
          projected.expiresAt,
          now(),
        ));
        return Response.json({ ok: true, ...projected }, { status: 200, headers });
      } catch (error) {
        return isPublicError(error)
          ? errorResponse("invalid_request", 400, requestId)
          : errorResponse("server_error", 500, requestId);
      }
    },

    async commit(request: Request) {
      const requestId = crypto.randomUUID();
      try {
        if (!dependencies.readiness().commit) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        const authority = requireWalletAuthority(request, dependencies.keyring);
        if (!validateMutation(request, dependencies.expectedOrigin, authority.csrf)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const idempotencyKey = requireIdempotencyKey(request);
        const body = await readBoundedJsonObject(request, 512);
        assertExactObjectKeys(body, ["operationId"]);
        const operationId = requireUuid(body.operationId);
        const challengeToken = readCookie(
          request.headers.get("cookie"),
          challengeCookieName(operationId),
        );
        if (challengeToken !== null && !TOKEN_PATTERN.test(challengeToken)) {
          throw new PublicAdmissionRequestError();
        }
        const result = await dependencies.repository.commit({
          environment: dependencies.environment,
          session: walletAuthorityCommand(authority, dependencies.keyring),
          operationId,
          commitIdempotencyKeyHash: createTicketAuthDigest(
            dependencies.keyring,
            "admission-commit-idempotency",
            `${authority.id}:${idempotencyKey}`,
          ),
          commitRequestHash: createTicketAuthDigest(
            dependencies.keyring,
            "admission-request",
            `commit:${authority.id}:${operationId}`,
          ),
          challengeTokenVerifier: challengeToken === null
            ? null
            : createTicketAuthDigest(
              dependencies.keyring,
              "admission-challenge",
              challengeToken,
            ),
        });
        if (result.action !== "result") return admissionFailure(result, requestId);
        return successResponse(projectResult(result), requestId);
      } catch (error) {
        return isPublicError(error)
          ? errorResponse("invalid_request", 400, requestId)
          : errorResponse("server_error", 500, requestId);
      }
    },

    async readResult(request: Request, operationIdInput: string) {
      const requestId = crypto.randomUUID();
      try {
        if (!dependencies.readiness().resultRead) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        if (!validateSafeBrowserRequest(request, dependencies.expectedOrigin)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const operationId = requireUuid(operationIdInput);
        const authority = requireWalletAuthority(request, dependencies.keyring);
        const result = await dependencies.repository.readResult({
          environment: dependencies.environment,
          session: walletAuthorityCommand(authority, dependencies.keyring),
          operationId,
        });
        if (result.action !== "result") return admissionFailure(result, requestId);
        return successResponse(projectResult(result), requestId);
      } catch (error) {
        return isPublicError(error)
          ? errorResponse("invalid_request", 400, requestId)
          : errorResponse("server_error", 500, requestId);
      }
    },
  };
}

function projectReadiness(result: Extract<TicketAdmissionReadinessResult, { action: "read" }>) {
  const serverNow = canonicalInstant(result.serverNow);
  if (
    !Number.isSafeInteger(result.maximumSelection)
    || result.maximumSelection < 0
    || result.maximumSelection > 20
    || (result.eventSessionId !== null && !UUID_PATTERN.test(result.eventSessionId))
  ) throw new Error("admission_readiness_invalid");
  return {
    state: result.state,
    serverNow,
    eventSessionId: result.eventSessionId,
    opensAt: result.opensAt === null ? null : canonicalInstant(result.opensAt),
    closesAt: result.closesAt === null ? null : canonicalInstant(result.closesAt),
    maximumSelection: result.maximumSelection,
  };
}

function projectPrepared(
  result: Extract<TicketAdmissionPreparedResult, { action: "prepared" | "reused" }>,
  observedAt: number,
) {
  if (
    !UUID_PATTERN.test(result.operationId)
    || !UUID_PATTERN.test(result.eventSessionId)
    || !isBoundedText(result.eventTitle, 240)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(result.eventDate)
    || !Number.isSafeInteger(result.selectedCount)
    || result.selectedCount < 1
    || result.selectedCount > 20
    || !Number.isSafeInteger(result.expectedVersion)
    || result.expectedVersion < 1
  ) throw new Error("admission_prepare_invalid");
  const expiry = Date.parse(result.challengeExpiresAt);
  if (
    !Number.isFinite(expiry)
    || new Date(expiry).toISOString() !== result.challengeExpiresAt
    || expiry <= observedAt
    || expiry > observedAt + ADMISSION_CHALLENGE_LIFETIME_MS
  ) throw new Error("admission_challenge_expiry_invalid");
  return {
    operationId: result.operationId,
    eventSessionId: result.eventSessionId,
    eventTitle: result.eventTitle,
    eventDate: result.eventDate,
    selectedCount: result.selectedCount,
    expiresAt: result.challengeExpiresAt,
    serverNow: result.serverNow ? canonicalInstant(result.serverNow) : new Date(observedAt).toISOString(),
  };
}

function projectResult(result: Extract<TicketAdmissionResult, { action: "result" }>) {
  if (
    !UUID_PATTERN.test(result.operationId)
    || !isBoundedText(result.eventTitle, 240)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(result.eventDate)
    || !Number.isSafeInteger(result.admittedCount)
    || result.admittedCount < 0
    || result.admittedCount > 20
  ) throw new Error("admission_result_invalid");
  const errorCode = isSafeErrorCode(result.errorCode) ? result.errorCode : undefined;
  return {
    operationId: result.operationId,
    state: result.state,
    eventTitle: result.eventTitle,
    eventDate: result.eventDate,
    admittedCount: result.admittedCount,
    admittedAt: result.admittedAt === null ? null : canonicalInstant(result.admittedAt),
    serverNow: canonicalInstant(result.serverNow),
    ...(errorCode ? { errorCode } : {}),
  };
}

function admissionFailure(
  result: Exclude<TicketAdmissionPreparedResult | TicketAdmissionResult, { action: "prepared" | "reused" | "result" }>,
  requestId: string,
) {
  if (result.action === "unauthenticated") return errorResponse("session_expired", 401, requestId);
  if (result.action === "not_found") return errorResponse("invalid_request", 404, requestId);
  if (result.action === "conflict") return errorResponse("conflict", 409, requestId);
  const error = mapSafeReason(result.reason);
  const status = error === "fresh_auth_required" ? 401
    : error === "rate_limited" ? 429
      : error === "feature_unavailable" ? 503
        : 409;
  return errorResponse(error, status, requestId);
}

function mapSafeReason(reason: string | undefined) {
  const mapping: Readonly<Record<string, string>> = {
    fresh_auth_required: "fresh_auth_required",
    admission_not_open: "admission_not_open",
    admission_too_early: "admission_not_open",
    admission_window_closed: "admission_window_closed",
    admission_too_late: "admission_window_closed",
    already_admitted: "already_admitted",
    manager_recovery_required: "manager_recovery_required",
    refund_review_required: "manager_recovery_required",
    rate_limited: "rate_limited",
    feature_unavailable: "feature_unavailable",
  };
  return reason && mapping[reason] ? mapping[reason] : "conflict";
}

function requireWalletAuthority(request: Request, keyring: TicketAuthKeyring) {
  const value = readCookie(request.headers.get("cookie"), WALLET_COOKIE);
  if (!value || value.length > 160) throw new PublicAdmissionRequestError();
  const separator = value.indexOf(".");
  if (separator < 1 || value.indexOf(".", separator + 1) !== -1) {
    throw new PublicAdmissionRequestError();
  }
  const id = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (!UUID_PATTERN.test(id) || !TOKEN_PATTERN.test(token)) {
    throw new PublicAdmissionRequestError();
  }
  return {
    id,
    token,
    csrf: createTicketAuthDigest(
      keyring,
      "wallet-session-csrf",
      `ghost.ticket-wallet.session-csrf.v1\0${id}\0${token}`,
    ),
  };
}

function walletAuthorityCommand(
  authority: Readonly<{ id: string; token: string }>,
  keyring: TicketAuthKeyring,
): WalletAuthorityCommand {
  return {
    sessionId: authority.id,
    tokenVerifier: createTicketAuthDigest(
      keyring,
      "wallet-session-token",
      authority.token,
    ),
  };
}

function validateMutation(request: Request, expectedOrigin: string, expectedCsrfToken: string) {
  return validateTicketWalletBrowserRequest(request, {
    expectedOrigin,
    expectedCsrfToken,
  }).ok;
}

function validateSafeBrowserRequest(request: Request, expectedOrigin: string) {
  if (!isExactHttpsOrigin(expectedOrigin)) return false;
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") return false;
  try {
    if (new URL(request.url).origin !== expectedOrigin) return false;
  } catch {
    return false;
  }
  if (fetchSite === "same-origin") return true;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function readAdmissionIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new PublicAdmissionRequestError();
  }
  const ids = value.map(requireUuid).sort();
  if (new Set(ids).size !== ids.length) throw new PublicAdmissionRequestError();
  return Object.freeze(ids);
}

function requireIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_PATTERN.test(value)) throw new PublicAdmissionRequestError();
  return value;
}

function deriveStableChallengeToken(sessionToken: string, idempotencyKey: string) {
  return createHmac("sha256", Buffer.from(sessionToken, "base64url"))
    .update("ghost.ticket-wallet.admission-challenge.v1\0", "utf8")
    .update(idempotencyKey, "utf8")
    .digest("base64url");
}

function challengeCookieName(operationId: string) {
  return `__Host-pure_ticket_admission_${operationId}`;
}

function serializeChallengeCookie(
  operationId: string,
  token: string,
  expiresAt: string,
  observedAt: number,
) {
  const expiry = Date.parse(expiresAt);
  const maxAge = Math.max(1, Math.min(300, Math.ceil((expiry - observedAt) / 1_000)));
  return `${challengeCookieName(operationId)}=${token}; Path=/; Expires=${new Date(expiry).toUTCString()}`
    + `; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const [key, ...rawValue] = segment.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new PublicAdmissionRequestError();
  }
  return value;
}

function requireToken(value: string | undefined) {
  if (!value || !TOKEN_PATTERN.test(value)) throw new Error("challenge_token_invalid");
  return value;
}

function canonicalInstant(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("instant_invalid");
  return new Date(parsed).toISOString();
}

function isSafeErrorCode(value: unknown): value is string {
  return typeof value === "string" && [
    "fresh_auth_required",
    "admission_not_open",
    "admission_window_closed",
    "already_admitted",
    "feature_unavailable",
    "manager_recovery_required",
    "conflict",
  ].includes(value);
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximum;
}

function isExactHttpsOrigin(value: string) {
  return isExactPublicOrigin(value);
}

function responseHeaders(requestId: string) {
  return new Headers({
    ...ticketWalletPrivateHeaders(),
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  });
}

function successResponse(payload: Readonly<Record<string, unknown>>, requestId: string) {
  return Response.json({ ok: true, ...payload }, {
    status: 200,
    headers: responseHeaders(requestId),
  });
}

function errorResponse(error: string, status: number, requestId: string) {
  return Response.json({ ok: false, error, requestId }, {
    status,
    headers: responseHeaders(requestId),
  });
}

class PublicAdmissionRequestError extends Error {}

function isPublicError(error: unknown) {
  return error instanceof PublicAdmissionRequestError
    || (error instanceof Error && [
      "request_body_invalid",
      "request_body_too_large",
      "request_fields_invalid",
    ].includes(error.message));
}
