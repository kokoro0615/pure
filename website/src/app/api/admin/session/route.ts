import { NextResponse } from "next/server";

import {
  assertAdminBootstrapRequest,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  createAdminSessionToken,
  getRequestId,
  hashAdminEmail,
  hashAdminSessionToken,
  normalizeAdminEmail,
  recordAdminAuditEvent,
  requireAdminSession,
} from "@/lib/server/adminAuth";
import {
  assertAdminCookieMutation,
  isHttpBodyError,
  readBoundedJsonObject,
} from "@/lib/server/httpBoundary";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { logSafeError } from "@/lib/server/safeErrorLog";

export const runtime = "nodejs";

type CreateAdminSessionResult = {
  adminId?: string;
  sessionId?: string;
  role?: string;
  displayName?: string | null;
  expiresAt?: string;
};

type ExistingAdminRecord = {
  id: string;
  role: string;
  active: boolean;
};

// Sessions minted through the shared bootstrap credential are capped at the
// same 12h bound as the service-owner endpoint. The RPC-side bound lands with
// create_admin_session_v8 (see remediation patches); this route is the first
// enforcement layer.
const MAX_BOOTSTRAP_SESSION_MINUTES = 12 * 60;

export async function POST(request: Request) {
  // Session minting is authorized by the bootstrap secret, not a cookie; the
  // boundary still rejects cross-site browser contexts so a foreign origin can
  // never drive this route from a victim browser.
  const boundary = assertAdminCookieMutation(request);
  if (!boundary.ok) {
    return NextResponse.json(
      { ok: false, error: boundary.error },
      { status: boundary.status },
    );
  }

  const bootstrapError = assertAdminBootstrapRequest(request);

  if (bootstrapError) {
    return bootstrapError;
  }

  let body: Record<string, unknown>;

  try {
    body = await readBoundedJsonObject(request, 4_096);
  } catch (error) {
    if (isHttpBodyError(error) && (error.code === "body_too_large" || error.code === "declared_length_too_large")) {
      return NextResponse.json({ ok: false, error: "request_body_too_large" }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "invalid_json_body" }, { status: 400 });
  }

  const email = normalizeAdminEmail(body.email);
  const displayName = readOptionalString(body.displayName);
  const role = readAdminRole(body.role);
  const expiresInMinutes = readExpiresInMinutes(body.expiresInMinutes);
  const reason = readReason(body.reason);

  if (!email) {
    return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
  }

  if (!role) {
    return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  }

  if (!expiresInMinutes) {
    return NextResponse.json({ ok: false, error: "invalid_expiresInMinutes" }, { status: 400 });
  }

  const emailHash = hashAdminEmail(email);
  const requestId = getRequestId(request);
  const supabase = createSupabaseAdminClient();

  // Bootstrap may authenticate an existing active admin for their *stored*
  // role, but it must never silently change a role or resurrect a retired
  // admin, and creating a brand-new admin requires an explicit provisioning
  // allow-list (ADMIN_BOOTSTRAP_ALLOWED_ROLES) so that the steady-state
  // production posture can keep new-admin creation closed.
  const { data: existingAdminData, error: lookupError } = await supabase
    .from("admin_users")
    .select("id, role, active")
    .eq("email_hash", emailHash)
    .maybeSingle();
  const existingAdmin = existingAdminData as ExistingAdminRecord | null;

  if (lookupError) {
    logSafeError(
      { scope: "admin.session.bootstrap", stage: "admin_lookup", requestId },
      lookupError,
    );
    return NextResponse.json(
      { ok: false, error: "admin_session_create_failed" },
      { status: 409 },
    );
  }

  const provisioning = !existingAdmin;

  if (existingAdmin && existingAdmin.active !== true) {
    return NextResponse.json(
      { ok: false, error: "admin_bootstrap_reactivation_denied" },
      { status: 403 },
    );
  }

  if (existingAdmin && existingAdmin.role !== role) {
    return NextResponse.json(
      { ok: false, error: "admin_bootstrap_role_change_denied" },
      { status: 403 },
    );
  }

  if (provisioning && !bootstrapProvisioningAllowedRoles().includes(role)) {
    return NextResponse.json(
      { ok: false, error: "admin_bootstrap_provisioning_denied" },
      { status: 403 },
    );
  }

  const token = createAdminSessionToken();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
  const { data, error } = await supabase.rpc("create_admin_session_v8", {
    p_email_hash: emailHash,
    p_display_name: displayName,
    p_role: role,
    p_session_token_hash: hashAdminSessionToken(token),
    p_expires_at: expiresAt,
    p_request_id: requestId,
    p_provision: provisioning,
    p_reason: reason,
  });

  if (error) {
    logSafeError(
      { scope: "admin.session.bootstrap", stage: "create_session_rpc", requestId },
      error,
    );
    return NextResponse.json({ ok: false, error: "admin_session_create_failed" }, { status: 409 });
  }

  const result = data as CreateAdminSessionResult | null;

  await recordAdminAuditEvent({
    actorAdminId: result?.adminId ?? existingAdmin?.id ?? null,
    action: "admin_session.bootstrap_issue",
    requestId,
    reason,
    afterJson: {
      sessionId: result?.sessionId ?? null,
      role: result?.role ?? role,
      expiresAt: result?.expiresAt ?? expiresAt,
      provisioning,
    },
  });

  // Browser logins receive only the HttpOnly cookie; a reusable bearer token
  // is returned solely to callers that explicitly opt into the service
  // credential transport.
  const bearerTransport = readSessionCredentialTransport(request) === "bearer";

  const response = NextResponse.json({
    ok: true,
    adminId: result?.adminId,
    sessionId: result?.sessionId,
    role: result?.role,
    displayName: result?.displayName ?? null,
    expiresAt: result?.expiresAt ?? expiresAt,
    credential: bearerTransport ? "bearer" : "cookie",
    ...(bearerTransport ? { token } : {}),
  });

  if (!bearerTransport) {
    const cookie = createAdminSessionCookie(token, result?.expiresAt ?? expiresAt);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
      path: cookie.path,
      expires: cookie.expires,
    });
  }

  return response;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    ok: true,
    adminId: auth.actor.adminId,
    sessionId: auth.actor.sessionId,
    role: auth.actor.role,
    displayName: auth.actor.displayName,
    requestId: auth.actor.requestId,
    cookieBacked: !request.headers.get("authorization"),
  });
}

export async function DELETE(request: Request) {
  // Cookie-authenticated logout: reject cross-site browser contexts. No JSON
  // body is required on DELETE.
  const boundary = assertAdminCookieMutation(request, { requireJsonBody: false });
  if (!boundary.ok) {
    return NextResponse.json(
      { ok: false, error: boundary.error },
      { status: boundary.status },
    );
  }

  const auth = await requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("retire_admin_session_v7", {
    p_session_token_hash: auth.tokenHash,
    p_request_id: auth.actor.requestId,
  });

  if (error) {
    logSafeError(
      {
        scope: "admin.session.retire",
        stage: "retire_session_rpc",
        requestId: auth.actor.requestId,
        actionId: auth.actor.adminId,
      },
      error,
    );
    return NextResponse.json({ ok: false, error: "admin_session_retire_failed" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, ...(data as Record<string, unknown> | null) });
  clearAdminSessionCookie(response);

  return response;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function readReason(value: unknown) {
  const reason = readOptionalString(value);
  return reason && reason.length <= 500 ? reason : null;
}

function readAdminRole(value: unknown) {
  if (
    value === "staff" ||
    value === "manager" ||
    value === "owner" ||
    value === "engineer" ||
    value === "accountant"
  ) {
    return value;
  }

  return null;
}

function readExpiresInMinutes(value: unknown) {
  if (value === undefined || value === null) {
    return 12 * 60;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_BOOTSTRAP_SESSION_MINUTES
  ) {
    return null;
  }

  return value;
}

function bootstrapProvisioningAllowedRoles() {
  return (process.env.ADMIN_BOOTSTRAP_ALLOWED_ROLES ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readSessionCredentialTransport(request: Request) {
  return request.headers.get("x-admin-session-transport")?.trim().toLowerCase() === "bearer"
    ? "bearer"
    : "cookie";
}
