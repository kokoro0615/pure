import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "./supabaseAdmin";
import { requireServerEnv } from "./env";
import { sha256Hex } from "./hash";
import { safeSecretEqual } from "./internalAuth";
import { logSafeError } from "./safeErrorLog";
import { stableJsonStringify, type JsonValue } from "./vipReservation";

export type AdminActor = {
  adminId: string;
  sessionId: string;
  role: string;
  displayName: string | null;
  requestId: string;
};

export type AdminAuthResult =
  | { ok: true; actor: AdminActor; tokenHash: string }
  | { ok: false; response: NextResponse };

type AuthenticateAdminResult = {
  adminId?: string;
  sessionId?: string;
  role?: string;
  displayName?: string | null;
  requestId?: string;
};

export const ADMIN_SESSION_COOKIE_NAME = "pure_admin_session";
const adminSessionCookiePath = "/api/admin";

/**
 * The audit request id is always server-generated. A client-supplied
 * `x-request-id` is untrusted input: accepting it verbatim would let callers
 * choose or collide audit ids, and echoed values could inject into log/CSV
 * sinks. Callers needing client correlation can read a sanitized, length-capped
 * value via `readClientCorrelationId` in `httpBoundary` — log-only, never
 * persisted.
 */
export function getRequestId(_request: Request) {
  return randomUUID();
}

export function createAdminSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function normalizeAdminEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() || null : null;
}

export function hashAdminEmail(email: string) {
  return sha256Hex(`${adminHashSalt()}:${email}`);
}

export function hashAdminSessionToken(token: string) {
  return sha256Hex(`${adminSessionHashSalt()}:${token}`);
}

export function hashAdminRateLimitKey(value: string) {
  return sha256Hex(`${adminRateLimitHashSalt()}:${value}`);
}

export function adminActionRequestHash(value: JsonValue) {
  return sha256Hex(stableJsonStringify(value));
}

export function assertAdminBootstrapRequest(request: Request) {
  const expected = requireServerEnv("ADMIN_BOOTSTRAP_SECRET");
  const actual = request.headers.get("x-admin-bootstrap-secret")?.trim();

  if (!safeSecretEqual(actual, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return null;
}

export async function requireAdminSession(request: Request): Promise<AdminAuthResult> {
  const token = readAdminSessionToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "missing_admin_session" }, { status: 401 }),
    };
  }

  const requestId = getRequestId(request);
  const tokenHash = hashAdminSessionToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("authenticate_admin_session_v7", {
    p_session_token_hash: tokenHash,
    p_request_id: requestId,
  });

  if (error) {
    logSafeError(
      { scope: "admin.auth.session", stage: "authenticate_rpc", requestId },
      error,
    );
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }

  const result = data as AuthenticateAdminResult | null;

  if (!result?.adminId || !result.sessionId || !result.role) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "invalid_admin_session" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    tokenHash,
    actor: {
      adminId: result.adminId,
      sessionId: result.sessionId,
      role: result.role,
      displayName: result.displayName ?? null,
      requestId: result.requestId ?? requestId,
    },
  };
}

export function createAdminSessionCookie(token: string, expiresAt: string) {
  return {
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict" as const,
    // Admin session cookies are always Secure. Public deployments (production
    // and preview) are HTTPS-only; local development on http://localhost keeps
    // working because localhost is a potentially trustworthy origin — matching
    // the ticket-wallet cookies, which are Secure unconditionally.
    secure: true,
    path: adminSessionCookiePath,
    expires: new Date(expiresAt),
  };
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: adminSessionCookiePath,
    maxAge: 0,
  });
}

export function readIdempotencyKey(request: Request) {
  return request.headers.get("idempotency-key")?.trim() || null;
}

function readAdminSessionToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearerToken) {
    return bearerToken;
  }

  return readCookie(request.headers.get("cookie"), ADMIN_SESSION_COOKIE_NAME);
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const segment of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = segment.trim().split("=");

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

/**
 * Synthetic shared-service identities whose sessions must never exercise
 * human-only privileges (money approvals, admin reactivation). The vipapp
 * console credential mints sessions for this fixed identity.
 */
export const SYNTHETIC_SERVICE_ADMIN_EMAILS = [
  "vip-manager-basic-owner@internal.pure",
] as const;

export function isSyntheticServiceEmailHash(emailHash: string | null | undefined) {
  return (
    typeof emailHash === "string" &&
    SYNTHETIC_SERVICE_ADMIN_EMAILS.some((email) => hashAdminEmail(email) === emailHash)
  );
}

/**
 * Resolves whether the authenticated actor is a shared service principal.
 * Fails closed: a lookup error counts as synthetic so a caller can never gain
 * human-only privileges because a read failed.
 */
export async function isSyntheticServiceActor(actor: AdminActor) {
  const { data, error } = await createSupabaseAdminClient()
    .from("admin_users")
    .select("email_hash")
    .eq("id", actor.adminId)
    .maybeSingle();

  if (error) {
    logSafeError(
      {
        scope: "admin.auth.actor_lookup",
        stage: "email_hash_lookup",
        requestId: actor.requestId,
        actionId: actor.adminId,
      },
      error,
    );
    return true;
  }

  return isSyntheticServiceEmailHash(data?.email_hash ?? null);
}

export async function assertHumanAdminActor(actor: AdminActor) {
  if (await isSyntheticServiceActor(actor)) {
    return NextResponse.json(
      { ok: false, error: "service_principal_forbidden" },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Supplementary audit row for routes that perform sensitive work outside a
 * dedicated audited RPC (session issuance, manual worker runs). Insert-only;
 * a failure never rewrites or deletes history.
 *
 * audit_logs is SELECT-only for service_role since v59, so the append goes
 * through record_admin_audit_event_v1 (v77, SECURITY DEFINER). A rejected or
 * failed write returns false — workers/run fails closed on it.
 */
export async function recordAdminAuditEvent(event: {
  actorAdminId: string | null;
  action: string;
  requestId: string;
  reason?: string | null;
  afterJson?: Record<string, unknown>;
}) {
  const { data, error } = await createSupabaseAdminClient().rpc("record_admin_audit_event_v1", {
    p_actor_admin_id: event.actorAdminId,
    p_action: event.action,
    p_request_id: event.requestId,
    p_reason: event.reason ?? null,
    p_after_json: (event.afterJson ?? {}) as JsonValue,
    p_target_table: null,
    p_target_id: null,
  });

  if (error) {
    logSafeError(
      {
        scope: "admin.auth.audit",
        stage: event.action,
        requestId: event.requestId,
        actionId: event.actorAdminId ?? undefined,
      },
      error,
    );
    return false;
  }

  if (data !== true) {
    // Definer-side rejection (non-allowlisted action or internal failure caught
    // by WHEN OTHERS): no PostgREST error surfaces, but nothing was written —
    // log so a dropped audit row is traceable instead of silently lost.
    logSafeError(
      {
        scope: "admin.auth.audit",
        stage: event.action,
        requestId: event.requestId,
        actionId: event.actorAdminId ?? undefined,
      },
      new Error("record_admin_audit_event_v1 rejected the write"),
    );
    return false;
  }

  return true;
}

function adminHashSalt() {
  const salt = process.env.ADMIN_HASH_SALT ?? process.env.RESERVATION_HASH_SALT;

  if (!salt) {
    // Fail closed: an empty salt would silently degrade admin identity and
    // session-token hashes to unsalted SHA-256.
    throw new Error(
      "Missing required server environment variable: ADMIN_HASH_SALT or RESERVATION_HASH_SALT",
    );
  }

  return salt;
}

function adminSessionHashSalt() {
  return process.env.ADMIN_SESSION_HASH_SALT ?? adminHashSalt();
}

function adminRateLimitHashSalt() {
  return process.env.ADMIN_RATE_LIMIT_HASH_SALT ?? adminHashSalt();
}
