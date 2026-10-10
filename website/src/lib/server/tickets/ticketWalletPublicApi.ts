import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { readIngressClientIp } from "../ingressClientIp";

import type { CapabilityReadiness } from "../../tickets/ticketWalletReadiness";
import {
  assertExactObjectKeys,
  PRE_AUTH_COOKIE,
  TICKET_WALLET_CSRF_HEADER,
  WALLET_COOKIE,
  readBoundedJsonObject,
  ticketWalletPrivateHeaders,
  validateTicketWalletBrowserRequest,
} from "./ticketWalletHttp";
import {
  createTicketAuthDigest,
  encryptTicketOtp,
  generateTicketOtp,
  type TicketAuthKeyring,
} from "./ticketAuthCrypto";
import {
  hashPurchaserEmail,
  normalizeTicketPurchaserEmail,
} from "./admissionCodes";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const PRE_AUTH_LIFETIME_MS = 15 * 60 * 1_000;
const PRE_AUTH_MINIMUM_REMAINING_MS = 12 * 60 * 1_000;
const OTP_LIFETIME_MS = 10 * 60 * 1_000;
const OTP_RESEND_DELAY_MS = 60 * 1_000;
const WALLET_FRESH_AUTH_MS = 12 * 60 * 60 * 1_000;
const WALLET_MAXIMUM_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

type BootstrapPreAuthCommand = Readonly<{
  now: string;
  presented: Readonly<{
    flowId: string;
    tokenVerifier: string;
  }> | null;
  candidate: Readonly<{
    flowId: string;
    tokenVerifier: string;
    csrfVerifier: string;
    expiresAt: string;
  }>;
  abuseIpHash: string;
  abuseUserAgentHash: string;
  minimumRemainingSeconds: 720;
  rateLimitPolicy: Readonly<{
    ipWindowSeconds: 600;
    ipMaximum: 100;
    globalWindowSeconds: 600;
    globalMaximum: 500;
  }>;
}>;

type BootstrapPreAuthResult =
  | Readonly<{
    action: "created" | "rotated" | "reused";
    flowId: string;
    expiresAt: string;
  }>
  | Readonly<{ action: "rate_limited" | "rejected" }>;

export type RequestTicketWalletOtpCommand = Readonly<{
  environment: "test" | "live";
  now: string;
  preAuth: Readonly<{
    flowId: string;
    tokenVerifier: string;
    csrfVerifier: string;
  }>;
  identityEmailHash: string;
  abuseEmailHash: string;
  abuseIpHash: string;
  abuseUserAgentHash: string;
  candidate: Readonly<{
    challengeId: string;
    codeVerifier: string;
    codeCiphertext: Buffer;
    expiresAt: string;
    resendAvailableAt: string;
    maximumAttempts: 5;
    providerIdempotencyKey: string;
    delivery: Readonly<{
      templateVersion: "ghost.ticket-wallet-otp.v1";
      renderReferenceAt: string;
      from: string;
      replyTo: string | null;
      walletUrl: string;
    }>;
  }>;
  minimumPreAuthRemainingSeconds: 720;
  minimumResendRemainingSeconds: 120;
  rateLimitPolicy: Readonly<{
    emailPerMinute: 1;
    emailPerHour: 5;
    emailPerDay: 10;
    ipPerTenMinutes: 100;
    ipPerDay: 500;
    preAuthPerTenMinutes: 20;
    globalPerTenMinutes: 300;
    globalPerDay: 2000;
  }>;
}>;

export type RequestTicketWalletOtpResult =
  | Readonly<{
    action: "accepted";
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
    attemptsRemaining: number;
    deliveryJobId: string | null;
  }>
  | Readonly<{
    action: "preauth_refresh_required" | "rate_limited" | "restart_required" | "rejected";
  }>;

export type VerifyTicketWalletOtpCommand = Readonly<{
  environment: "test" | "live";
  now: string;
  preAuth: Readonly<{
    flowId: string;
    tokenVerifier: string;
    csrfVerifier: string;
  }>;
  submittedCodeVerifier: string;
  abuseIpHash: string;
  candidate: Readonly<{
    sessionId: string;
    sessionTokenVerifier: string;
    sessionCsrfVerifier: string;
    keyId: string;
    freshUntil: string;
    maximumExpiresAt: string;
    maximumActiveSessions: 3;
  }>;
}>;

export type VerifyTicketWalletOtpResult =
  | Readonly<{
    action: "verified";
    sessionId: string;
    verifiedAt: string;
    freshUntil: string;
    expiresAt: string;
  }>
  | Readonly<{
    action: "rejected";
    reason: "invalid_code" | "attempts_exhausted" | "challenge_expired" | "preauth_invalid" | "rate_limited";
    attemptsRemaining?: number;
  }>;

export type TicketWalletSessionCommand = Readonly<{
  environment: "test" | "live";
  now: string;
  session: Readonly<{
    sessionId: string;
    tokenVerifier: string;
    csrfVerifier: string;
  }>;
}>;

export type TicketWalletSessionResult =
  | Readonly<{
    action: "authenticated";
    sessionId: string;
    expiresAt: string;
    freshUntil: string;
  }>
  | Readonly<{ action: "unauthenticated" }>;

export type TicketWalletViewResult =
  | Readonly<{
    action: "loaded";
    serverNow: string;
    events: readonly Readonly<{
      eventSessionId: string;
      eventTitle: string;
      eventDate: string;
      doorsAt: string;
      admissionOpensAt: string;
      admissionClosesAt: string;
      demoAdmissionTest?: boolean;
      admissions: readonly Readonly<{
        admissionId: string;
        eventSessionId: string;
        selectionGroupId: string;
        admissionPolicy?: "individual_v1" | "order_together_v1";
        serial: number;
        label: string;
        status: "issued" | "admitted" | "void" | "refunded" | "disputed";
        admittedAt: string | null;
      }>[];
    }>[];
  }>
  | Readonly<{ action: "unauthenticated" }>;

export interface TicketWalletPublicRepository {
  bootstrapPreAuth(command: BootstrapPreAuthCommand): Promise<BootstrapPreAuthResult>;
  requestOtp(command: RequestTicketWalletOtpCommand): Promise<RequestTicketWalletOtpResult>;
  verifyOtp(command: VerifyTicketWalletOtpCommand): Promise<VerifyTicketWalletOtpResult>;
  readSession(command: TicketWalletSessionCommand): Promise<TicketWalletSessionResult>;
  revokeSession(
    command: TicketWalletSessionCommand & Readonly<{ reason: "customer_logout" }>,
  ): Promise<Readonly<{ action: "revoked" | "reused" | "unauthenticated" }>>;
  readWallet(command: TicketWalletSessionCommand): Promise<TicketWalletViewResult>;
}

type TicketWalletPublicApiDependencies = Readonly<{
  repository: TicketWalletPublicRepository;
  keyring: TicketAuthKeyring;
  environment: "test" | "live";
  expectedOrigin: string;
  readiness(): Readonly<{
    otpDelivery: CapabilityReadiness;
    walletRead: CapabilityReadiness;
  }>;
  now?: () => number;
  randomId?: () => string | undefined;
  randomToken?: () => string | undefined;
  randomOtp?: () => string;
  hashIdentityEmail?: (normalizedEmail: string) => string | null;
  verifyTurnstile(
    token: string,
    request: Request,
  ): Promise<Readonly<{ ok: true }> | Readonly<{
    ok: false;
    error: "missing_turnstile_token" | "turnstile_failed" | "turnstile_unavailable";
  }>>;
  scheduleOtpDelivery?: (deliveryJobId: string) => void;
  otpDeliverySnapshot: Readonly<{
    from: string;
    replyTo: string | null;
    walletUrl: string;
  }>;
}>;

export function createTicketWalletPublicApi(dependencies: TicketWalletPublicApiDependencies) {
  const now = dependencies.now ?? Date.now;
  const randomId = dependencies.randomId ?? randomUUID;
  const randomToken = dependencies.randomToken
    ?? (() => randomBytes(32).toString("base64url"));
  const randomOtp = dependencies.randomOtp ?? generateTicketOtp;
  const hashIdentityEmail = dependencies.hashIdentityEmail ?? hashPurchaserEmail;

  return {
    async bootstrapOtp(request: Request) {
      const requestId = randomUUID();
      try {
        if (!dependencies.readiness().otpDelivery.ok) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        if (!validateSafeBrowserRequest(request, dependencies.expectedOrigin)) {
          return errorResponse("invalid_request", 403, requestId);
        }

        const observedAt = now();
        if (!Number.isFinite(observedAt)) throw new Error("clock_invalid");
        const presentedCookie = readCookie(request, PRE_AUTH_COOKIE);
        const presented = parseAuthorityCookie(presentedCookie);
        const candidateFlowId = requireId(randomId());
        const candidateToken = requireToken(randomToken());
        const candidateCsrf = derivePreAuthCsrf(
          dependencies.keyring,
          candidateFlowId,
          candidateToken,
        );
        const candidateExpiresAt = new Date(observedAt + PRE_AUTH_LIFETIME_MS).toISOString();
        const result = await dependencies.repository.bootstrapPreAuth({
          now: new Date(observedAt).toISOString(),
          presented: presented
            ? {
              flowId: presented.id,
              tokenVerifier: createTicketAuthDigest(
                dependencies.keyring,
                "pre-auth-token",
                presented.token,
              ),
            }
            : null,
          candidate: {
            flowId: candidateFlowId,
            tokenVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-token",
              candidateToken,
            ),
            csrfVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-csrf",
              candidateCsrf,
            ),
            expiresAt: candidateExpiresAt,
          },
          abuseIpHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-ip",
            readClientNetworkValue(request),
          ),
          abuseUserAgentHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-user-agent",
            request.headers.get("user-agent")?.slice(0, 1_024) || "unknown",
          ),
          minimumRemainingSeconds: PRE_AUTH_MINIMUM_REMAINING_MS / 1_000 as 720,
          rateLimitPolicy: {
            ipWindowSeconds: 600,
            ipMaximum: 100,
            globalWindowSeconds: 600,
            globalMaximum: 500,
          },
        });

        if (result.action === "rate_limited") {
          return errorResponse("rate_limited", 429, requestId);
        }
        if (result.action === "rejected") throw new Error("pre_auth_rejected");
        const successfulResult = result as Extract<
          BootstrapPreAuthResult,
          { action: "created" | "rotated" | "reused" }
        >;

        const authority = successfulResult.action === "reused" ? presented : {
          id: candidateFlowId,
          token: candidateToken,
        };
        if (!authority || successfulResult.flowId !== authority.id) {
          throw new Error("pre_auth_authority_mismatch");
        }
        const expiresAt = readAuthorityExpiry(
          successfulResult.expiresAt,
          observedAt,
          PRE_AUTH_LIFETIME_MS,
        );
        const csrf = derivePreAuthCsrf(dependencies.keyring, authority.id, authority.token);
        const headers = responseHeaders(requestId);
        headers.set(TICKET_WALLET_CSRF_HEADER, csrf);
        headers.append("set-cookie", serializeAuthorityCookie(
          PRE_AUTH_COOKIE,
          `${authority.id}.${authority.token}`,
          expiresAt,
        ));
        return Response.json({
          ok: true,
          requestId,
          expiresAt: expiresAt.toISOString(),
        }, { status: 200, headers });
      } catch {
        return errorResponse("server_error", 500, requestId);
      }
    },

    async requestOtp(request: Request) {
      const requestId = randomUUID();
      try {
        if (!dependencies.readiness().otpDelivery.ok) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        const authority = requirePreAuthAuthority(request, dependencies.keyring);
        const browser = validateTicketWalletBrowserRequest(request, {
          expectedOrigin: dependencies.expectedOrigin,
          expectedCsrfToken: authority.csrf,
        });
        if (!browser.ok) return errorResponse("invalid_request", 403, requestId);

        const body = await readBoundedJsonObject(request, 4_096);
        assertExactObjectKeys(body, ["email", "turnstileToken"]);
        const turnstileToken = readTurnstileToken(body.turnstileToken);
        let turnstile: Awaited<ReturnType<TicketWalletPublicApiDependencies["verifyTurnstile"]>>;
        try {
          turnstile = await dependencies.verifyTurnstile(turnstileToken, request);
        } catch {
          return errorResponse("turnstile_unavailable", 503, requestId);
        }
        if (!turnstile.ok) {
          const unavailable = turnstile.error === "turnstile_unavailable";
          return errorResponse(
            unavailable ? "turnstile_unavailable" : "turnstile_failed",
            unavailable ? 503 : 403,
            requestId,
          );
        }
        const email = readEmail(body.email);
        const identityEmailHash = hashIdentityEmail(email);
        if (!identityEmailHash) return errorResponse("invalid_request", 400, requestId);

        const observedAt = now();
        if (!Number.isFinite(observedAt)) throw new Error("clock_invalid");
        const delivery = readOtpDeliverySnapshot(
          dependencies.otpDeliverySnapshot,
          dependencies.expectedOrigin,
          observedAt,
        );
        const challengeId = requireId(randomId());
        const otp = randomOtp();
        if (!/^\d{6}$/u.test(otp)) throw new Error("otp_invalid");
        const expiresAt = new Date(observedAt + OTP_LIFETIME_MS).toISOString();
        const resendAvailableAt = new Date(observedAt + OTP_RESEND_DELAY_MS).toISOString();
        const result = await dependencies.repository.requestOtp({
          environment: dependencies.environment,
          now: new Date(observedAt).toISOString(),
          preAuth: {
            flowId: authority.id,
            tokenVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-token",
              authority.token,
            ),
            csrfVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-csrf",
              authority.csrf,
            ),
          },
          identityEmailHash,
          abuseEmailHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-email",
            email,
          ),
          abuseIpHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-ip",
            readClientNetworkValue(request),
          ),
          abuseUserAgentHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-user-agent",
            request.headers.get("user-agent")?.slice(0, 1_024) || "unknown",
          ),
          candidate: {
            challengeId,
            codeVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "otp-verifier",
              `${authority.id}:${otp}`,
            ),
            codeCiphertext: encryptTicketOtp(
              dependencies.keyring,
              otp,
              challengeId,
            ),
            expiresAt,
            resendAvailableAt,
            maximumAttempts: 5,
            providerIdempotencyKey: `ghost-ticket-wallet-otp-v1-${challengeId}`,
            delivery,
          },
          minimumPreAuthRemainingSeconds: 720,
          minimumResendRemainingSeconds: 120,
          rateLimitPolicy: {
            emailPerMinute: 1,
            emailPerHour: 5,
            emailPerDay: 10,
            ipPerTenMinutes: 100,
            ipPerDay: 500,
            preAuthPerTenMinutes: 20,
            globalPerTenMinutes: 300,
            globalPerDay: 2_000,
          },
        });

        if (result.action === "preauth_refresh_required") {
          return errorResponse("preauth_refresh_required", 409, requestId);
        }
        if (result.action === "rate_limited") {
          return errorResponse("rate_limited", 429, requestId);
        }
        if (result.action === "restart_required") {
          return errorResponse("challenge_expired", 409, requestId);
        }
        if (result.action !== "accepted") throw new Error("otp_request_rejected");
        if (!UUID_PATTERN.test(result.challengeId)) throw new Error("challenge_id_invalid");
        const responseExpiry = readAuthorityExpiry(result.expiresAt, observedAt, OTP_LIFETIME_MS);
        const resendAt = readInstantWithin(
          result.resendAvailableAt,
          observedAt - OTP_RESEND_DELAY_MS,
          responseExpiry.getTime(),
        );
        if (
          !Number.isSafeInteger(result.attemptsRemaining)
          || result.attemptsRemaining < 0
          || result.attemptsRemaining > 5
        ) {
          throw new Error("otp_attempts_invalid");
        }
        if (result.deliveryJobId) {
          requireId(result.deliveryJobId);
          dependencies.scheduleOtpDelivery?.(result.deliveryJobId);
        }
        return Response.json({
          ok: true,
          requestId,
          accepted: true,
          expiresAt: responseExpiry.toISOString(),
          resendAvailableAt: resendAt.toISOString(),
          attemptsRemaining: result.attemptsRemaining,
        }, { status: 202, headers: responseHeaders(requestId) });
      } catch (error) {
        if (isPublicRequestError(error)) {
          return errorResponse("invalid_request", 400, requestId);
        }
        return errorResponse("server_error", 500, requestId);
      }
    },

    async verifyOtp(request: Request) {
      const requestId = randomUUID();
      try {
        if (!dependencies.readiness().walletRead.ok) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        const authority = requirePreAuthAuthority(request, dependencies.keyring);
        const browser = validateTicketWalletBrowserRequest(request, {
          expectedOrigin: dependencies.expectedOrigin,
          expectedCsrfToken: authority.csrf,
        });
        if (!browser.ok) return errorResponse("invalid_request", 403, requestId);

        const body = await readBoundedJsonObject(request, 256);
        assertExactObjectKeys(body, ["code"]);
        if (typeof body.code !== "string" || !/^\d{6}$/u.test(body.code)) {
          throw new PublicRequestError();
        }

        const observedAt = now();
        if (!Number.isFinite(observedAt)) throw new Error("clock_invalid");
        const sessionId = requireId(randomId());
        const sessionToken = requireToken(randomToken());
        const sessionCsrf = deriveWalletCsrf(dependencies.keyring, sessionId, sessionToken);
        const result = await dependencies.repository.verifyOtp({
          environment: dependencies.environment,
          now: new Date(observedAt).toISOString(),
          preAuth: {
            flowId: authority.id,
            tokenVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-token",
              authority.token,
            ),
            csrfVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "pre-auth-csrf",
              authority.csrf,
            ),
          },
          submittedCodeVerifier: createTicketAuthDigest(
            dependencies.keyring,
            "otp-verifier",
            `${authority.id}:${body.code}`,
          ),
          abuseIpHash: createTicketAuthDigest(
            dependencies.keyring,
            "abuse-ip",
            readClientNetworkValue(request),
          ),
          candidate: {
            sessionId,
            sessionTokenVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "wallet-session-token",
              sessionToken,
            ),
            sessionCsrfVerifier: createTicketAuthDigest(
              dependencies.keyring,
              "wallet-session-csrf",
              sessionCsrf,
            ),
            keyId: dependencies.keyring.activeKeyId,
            freshUntil: new Date(observedAt + WALLET_FRESH_AUTH_MS).toISOString(),
            maximumExpiresAt: new Date(observedAt + WALLET_MAXIMUM_LIFETIME_MS).toISOString(),
            maximumActiveSessions: 3,
          },
        });

        if (result.action === "rejected") {
          return otpVerificationError(result, requestId);
        }
        if (result.sessionId !== sessionId) throw new Error("wallet_session_authority_mismatch");
        readInstantWithin(result.verifiedAt, observedAt - 5 * 60_000, observedAt + 5 * 60_000);
        const expiresAt = readAuthorityExpiry(
          result.expiresAt,
          observedAt,
          WALLET_MAXIMUM_LIFETIME_MS,
        );
        const freshUntil = readInstantWithin(
          result.freshUntil,
          observedAt,
          Math.min(observedAt + WALLET_FRESH_AUTH_MS, expiresAt.getTime()),
        );
        const headers = responseHeaders(requestId);
        headers.set(TICKET_WALLET_CSRF_HEADER, sessionCsrf);
        headers.append("set-cookie", expireAuthorityCookie(PRE_AUTH_COOKIE));
        headers.append("set-cookie", serializeAuthorityCookie(
          WALLET_COOKIE,
          `${sessionId}.${sessionToken}`,
          expiresAt,
        ));
        return Response.json({
          ok: true,
          requestId,
          authenticated: true,
          expiresAt: expiresAt.toISOString(),
          freshAuthenticationUntil: freshUntil.toISOString(),
        }, { status: 200, headers });
      } catch (error) {
        if (isPublicRequestError(error)) {
          return errorResponse("invalid_request", 400, requestId);
        }
        return errorResponse("server_error", 500, requestId);
      }
    },

    async readSession(request: Request) {
      const requestId = randomUUID();
      try {
        if (!dependencies.readiness().walletRead.ok) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        if (!validateSafeBrowserRequest(request, dependencies.expectedOrigin)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const observedAt = now();
        const authority = requireWalletAuthority(request, dependencies.keyring);
        const result = await dependencies.repository.readSession(
          walletSessionCommand(dependencies, authority, observedAt),
        );
        if (result.action !== "authenticated") {
          return errorResponse("session_expired", 401, requestId);
        }
        const session = readSessionResult(result, authority.id, observedAt);
        const headers = responseHeaders(requestId);
        headers.set(TICKET_WALLET_CSRF_HEADER, authority.csrf);
        return Response.json({
          ok: true,
          requestId,
          authenticated: true,
          expiresAt: session.expiresAt,
          freshAuthenticationUntil: session.freshUntil,
        }, { status: 200, headers });
      } catch (error) {
        if (isPublicRequestError(error)) {
          return errorResponse("session_expired", 401, requestId);
        }
        return errorResponse("server_error", 500, requestId);
      }
    },

    async logout(request: Request) {
      const requestId = randomUUID();
      try {
        const authority = requireWalletAuthority(request, dependencies.keyring);
        const browser = validateTicketWalletBrowserRequest(request, {
          expectedOrigin: dependencies.expectedOrigin,
          expectedCsrfToken: authority.csrf,
        });
        if (!browser.ok) return errorResponse("invalid_request", 403, requestId);
        const body = await readBoundedJsonObject(request, 64);
        assertExactObjectKeys(body, []);
        const headers = responseHeaders(requestId);
        headers.append("set-cookie", expireAuthorityCookie(WALLET_COOKIE));
        let result: Awaited<ReturnType<TicketWalletPublicRepository["revokeSession"]>>;
        try {
          const observedAt = now();
          if (!Number.isFinite(observedAt)) throw new Error("clock_invalid");
          result = await dependencies.repository.revokeSession({
            ...walletSessionCommand(dependencies, authority, observedAt),
            reason: "customer_logout",
          });
        } catch {
          return Response.json({
            ok: false,
            error: "logout_unconfirmed",
            requestId,
            authenticated: false,
          }, { status: 503, headers });
        }
        if (
          result.action !== "revoked"
          && result.action !== "reused"
          && result.action !== "unauthenticated"
        ) {
          return Response.json({
            ok: false,
            error: "logout_unconfirmed",
            requestId,
            authenticated: false,
          }, { status: 503, headers });
        }
        return Response.json({ ok: true, requestId, authenticated: false }, {
          status: 200,
          headers,
        });
      } catch (error) {
        if (isPublicRequestError(error)) {
          return errorResponse("invalid_request", 400, requestId);
        }
        return errorResponse("server_error", 500, requestId);
      }
    },

    async readWallet(request: Request) {
      const requestId = randomUUID();
      try {
        if (!dependencies.readiness().walletRead.ok) {
          return errorResponse("feature_unavailable", 503, requestId);
        }
        if (!validateSafeBrowserRequest(request, dependencies.expectedOrigin)) {
          return errorResponse("invalid_request", 403, requestId);
        }
        const observedAt = now();
        const authority = requireWalletAuthority(request, dependencies.keyring);
        const result = await dependencies.repository.readWallet(
          walletSessionCommand(dependencies, authority, observedAt),
        );
        if (result.action !== "loaded") {
          return errorResponse("session_expired", 401, requestId);
        }
        const wallet = readWalletResult(result, observedAt);
        return Response.json({ ok: true, requestId, ...wallet }, {
          status: 200,
          headers: responseHeaders(requestId),
        });
      } catch (error) {
        if (isPublicRequestError(error)) {
          return errorResponse("session_expired", 401, requestId);
        }
        return errorResponse("server_error", 500, requestId);
      }
    },
  };
}

export function derivePreAuthCsrf(keyring: TicketAuthKeyring, flowId: string, token: string) {
  return createTicketAuthDigest(
    keyring,
    "pre-auth-csrf",
    `ghost.ticket-wallet.pre-auth-csrf.v1\0${flowId}\0${token}`,
  );
}

export function deriveWalletCsrf(keyring: TicketAuthKeyring, sessionId: string, token: string) {
  return createTicketAuthDigest(
    keyring,
    "wallet-session-csrf",
    `ghost.ticket-wallet.session-csrf.v1\0${sessionId}\0${token}`,
  );
}

export function parseAuthorityCookie(value: string | null) {
  if (!value || value.length > 160) return null;
  const separator = value.indexOf(".");
  if (separator < 1 || value.indexOf(".", separator + 1) !== -1) return null;
  const id = value.slice(0, separator);
  const token = value.slice(separator + 1);
  return UUID_PATTERN.test(id) && TOKEN_PATTERN.test(token) ? { id, token } : null;
}

export function requirePreAuthAuthority(request: Request, keyring: TicketAuthKeyring) {
  const parsed = parseAuthorityCookie(readCookie(request, PRE_AUTH_COOKIE));
  if (!parsed) throw new PublicRequestError();
  return {
    ...parsed,
    csrf: derivePreAuthCsrf(keyring, parsed.id, parsed.token),
  };
}

export function requireWalletAuthority(request: Request, keyring: TicketAuthKeyring) {
  const parsed = parseAuthorityCookie(readCookie(request, WALLET_COOKIE));
  if (!parsed) throw new PublicRequestError();
  return {
    ...parsed,
    csrf: deriveWalletCsrf(keyring, parsed.id, parsed.token),
  };
}

export function walletSessionCommand(
  dependencies: Pick<TicketWalletPublicApiDependencies, "environment" | "keyring">,
  authority: ReturnType<typeof requireWalletAuthority>,
  observedAt: number,
): TicketWalletSessionCommand {
  if (!Number.isFinite(observedAt)) throw new Error("clock_invalid");
  return {
    environment: dependencies.environment,
    now: new Date(observedAt).toISOString(),
    session: {
      sessionId: authority.id,
      tokenVerifier: createTicketAuthDigest(
        dependencies.keyring,
        "wallet-session-token",
        authority.token,
      ),
      csrfVerifier: createTicketAuthDigest(
        dependencies.keyring,
        "wallet-session-csrf",
        authority.csrf,
      ),
    },
  };
}

export function readCookie(request: Request, name: string) {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  return matches[0].slice(name.length + 1);
}

function serializeAuthorityCookie(name: string, value: string, expires: Date) {
  return `${name}=${value}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Strict`;
}

function expireAuthorityCookie(name: string) {
  return `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function readAuthorityExpiry(value: string, now: number, maximumLifetimeMs: number) {
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== value
    || parsed <= now
    || parsed > now + maximumLifetimeMs
  ) {
    throw new Error("authority_expiry_invalid");
  }
  return new Date(parsed);
}

function readInstantWithin(value: string, minimum: number, maximum: number) {
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== value
    || parsed < minimum
    || parsed > maximum
  ) {
    throw new Error("instant_invalid");
  }
  return new Date(parsed);
}

function readEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 320) throw new PublicRequestError();
  const normalized = normalizeTicketPurchaserEmail(value);
  if (
    !normalized
    || normalized !== value.trim().toLowerCase()
    || !/^[^\s<>@]+@[^\s<>@]+$/u.test(normalized)
  ) {
    throw new PublicRequestError();
  }
  return normalized;
}

function readTurnstileToken(value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2_048) {
    throw new PublicRequestError();
  }
  return value;
}

function readOtpDeliverySnapshot(
  snapshot: TicketWalletPublicApiDependencies["otpDeliverySnapshot"],
  expectedOrigin: string,
  observedAt: number,
) {
  if (
    !isBoundedHeader(snapshot.from)
    || (snapshot.replyTo !== null && !isBoundedHeader(snapshot.replyTo))
  ) {
    throw new Error("otp_delivery_snapshot_invalid");
  }
  let walletUrl: URL;
  try {
    walletUrl = new URL(snapshot.walletUrl);
  } catch {
    throw new Error("otp_delivery_snapshot_invalid");
  }
  if (
    walletUrl.protocol !== "https:"
    || walletUrl.origin !== expectedOrigin
    || walletUrl.pathname !== "/tickets/wallet"
    || walletUrl.search
    || walletUrl.hash
    || walletUrl.username
    || walletUrl.password
  ) {
    throw new Error("otp_delivery_snapshot_invalid");
  }
  return Object.freeze({
    templateVersion: "ghost.ticket-wallet-otp.v1" as const,
    renderReferenceAt: new Date(observedAt).toISOString(),
    from: snapshot.from,
    replyTo: snapshot.replyTo,
    walletUrl: walletUrl.toString(),
  });
}

function isBoundedHeader(value: string) {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 998
    && !/[\r\n\0]/u.test(value);
}

function requireId(value: string | undefined) {
  if (!value || !UUID_PATTERN.test(value)) throw new Error("authority_id_invalid");
  return value;
}

function requireToken(value: string | undefined) {
  if (!value || !TOKEN_PATTERN.test(value)) throw new Error("authority_token_invalid");
  return value;
}

function responseHeaders(requestId: string) {
  return new Headers({
    ...ticketWalletPrivateHeaders(),
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  });
}

function errorResponse(error: string, status: number, requestId: string) {
  return Response.json({ ok: false, error, requestId }, {
    status,
    headers: responseHeaders(requestId),
  });
}

function otpVerificationError(
  result: Extract<VerifyTicketWalletOtpResult, { action: "rejected" }>,
  requestId: string,
) {
  if (result.reason === "invalid_code") {
    const attemptsRemaining = Number.isSafeInteger(result.attemptsRemaining)
      && (result.attemptsRemaining ?? -1) >= 0
      && (result.attemptsRemaining ?? 6) <= 5
      ? result.attemptsRemaining
      : null;
    return Response.json({
      ok: false,
      error: "invalid_code",
      requestId,
      attemptsRemaining,
    }, { status: 401, headers: responseHeaders(requestId) });
  }
  if (result.reason === "attempts_exhausted") {
    return errorResponse("attempts_exhausted", 423, requestId);
  }
  if (result.reason === "challenge_expired") {
    return errorResponse("challenge_expired", 410, requestId);
  }
  if (result.reason === "rate_limited") {
    return errorResponse("rate_limited", 429, requestId);
  }
  return errorResponse("session_expired", 401, requestId);
}

function validateSafeBrowserRequest(request: Request, expectedOrigin: string) {
  if (!isExactHttpsOrigin(expectedOrigin)) return false;
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (fetchSite === "same-origin") {
    try {
      return new URL(request.url).origin === expectedOrigin;
    } catch {
      return false;
    }
  }
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

function isExactHttpsOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.origin === value
      && url.pathname === "/"
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

export function readClientNetworkValue(request: Request) {
  // G-17: only platform-asserted IP headers; cf-connecting-ip and left-most
  // XFF are client-controllable on Vercel and must not key abuse buckets.
  return readIngressClientIp(request).slice(0, 128);
}

class PublicRequestError extends Error {}

function isPublicRequestError(error: unknown) {
  return error instanceof PublicRequestError
    || (error instanceof Error && (
      error.message === "request_body_invalid"
      || error.message === "request_body_too_large"
      || error.message === "request_fields_invalid"
  ));
}

function readSessionResult(
  result: Extract<TicketWalletSessionResult, { action: "authenticated" }>,
  expectedSessionId: string,
  observedAt: number,
) {
  if (result.sessionId !== expectedSessionId) {
    throw new Error("wallet_session_authority_mismatch");
  }
  const expiresAt = readAuthorityExpiry(
    result.expiresAt,
    observedAt,
    WALLET_MAXIMUM_LIFETIME_MS,
  );
  const freshUntil = readInstantWithin(
    result.freshUntil,
    observedAt - WALLET_FRESH_AUTH_MS,
    expiresAt.getTime(),
  );
  return {
    expiresAt: expiresAt.toISOString(),
    freshUntil: freshUntil.toISOString(),
  };
}

function readWalletResult(
  result: Extract<TicketWalletViewResult, { action: "loaded" }>,
  observedAt: number,
) {
  if (!Array.isArray(result.events) || result.events.length > 100) {
    throw new Error("wallet_events_invalid");
  }
  const serverNow = readInstantWithin(
    result.serverNow,
    observedAt - 5 * 60_000,
    observedAt + 5 * 60_000,
  ).toISOString();
  const seenEvents = new Set<string>();
  const seenAdmissions = new Set<string>();
  const events = result.events.map((event) => {
    if (
      !UUID_PATTERN.test(event.eventSessionId)
      || seenEvents.has(event.eventSessionId)
      || !isBoundedText(event.eventTitle, 200)
      || !/^\d{4}-\d{2}-\d{2}$/u.test(event.eventDate)
      || !Array.isArray(event.admissions)
      || event.admissions.length > 20
    ) {
      throw new Error("wallet_event_invalid");
    }
    seenEvents.add(event.eventSessionId);
    const doorsAt = readIsoInstant(event.doorsAt);
    const admissionOpensAt = readIsoInstant(event.admissionOpensAt);
    const admissionClosesAt = readIsoInstant(event.admissionClosesAt);
    if (admissionOpensAt.getTime() >= admissionClosesAt.getTime()) {
      throw new Error("wallet_event_window_invalid");
    }
    const admissions = event.admissions.map((admission: (
      Extract<TicketWalletViewResult, { action: "loaded" }>["events"][number]["admissions"][number]
    )) => {
      if (
        !UUID_PATTERN.test(admission.admissionId)
        || seenAdmissions.has(admission.admissionId)
        || admission.eventSessionId !== event.eventSessionId
        || !UUID_PATTERN.test(admission.selectionGroupId)
        || !Number.isSafeInteger(admission.serial)
        || admission.serial < 1
        || admission.serial > 20
        || !isBoundedText(admission.label, 200)
        || !["issued", "admitted", "void", "refunded", "disputed"].includes(admission.status)
      ) {
        throw new Error("wallet_admission_invalid");
      }
      seenAdmissions.add(admission.admissionId);
      return {
        admissionId: admission.admissionId,
        eventSessionId: admission.eventSessionId,
        selectionGroupId: admission.selectionGroupId,
          ...(admission.admissionPolicy === undefined ? {} : { admissionPolicy: admission.admissionPolicy === "order_together_v1" ? "order_together_v1" as const : admission.admissionPolicy === "individual_v1" ? "individual_v1" as const : (() => { throw new Error("wallet_admission_policy_invalid"); })() }),
        serial: admission.serial,
        label: admission.label,
        status: admission.status,
        admittedAt: admission.admittedAt === null
          ? null
          : readIsoInstant(admission.admittedAt).toISOString(),
      };
    });
    return {
      eventSessionId: event.eventSessionId,
      eventTitle: event.eventTitle,
      eventDate: event.eventDate,
      doorsAt: doorsAt.toISOString(),
      admissionOpensAt: admissionOpensAt.toISOString(),
      admissionClosesAt: admissionClosesAt.toISOString(),
      ...(event.demoAdmissionTest === true ? {demoAdmissionTest:true} : {}),
      admissions,
    };
  });
  return { serverNow, events };
}

function readIsoInstant(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("instant_invalid");
  }
  return new Date(parsed);
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximum;
}
