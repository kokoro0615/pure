import { NextResponse } from "next/server";

import {
  createAdminSessionToken,
  getRequestId,
  hashAdminEmail,
  hashAdminSessionToken,
  recordAdminAuditEvent,
} from "@/lib/server/adminAuth";
import { safeSecretEqual } from "@/lib/server/internalAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { logSafeError } from "@/lib/server/safeErrorLog";

export const runtime = "nodejs";

const DEFAULT_OWNER_SESSION_MINUTES = 12 * 60;
const MAX_OWNER_SESSION_MINUTES = 12 * 60;
const MIN_OWNER_SESSION_MINUTES = 5;
const OWNER_SESSION_MINUTES_ENV = "PURE_BASIC_OWNER_SESSION_MINUTES";
const OWNER_EMAIL = "vip-manager-basic-owner@internal.pure";
const SESSION_SECRET_HEADER = "x-pure-owner-session-secret";
const SESSION_REASON_HEADER = "x-pure-owner-session-reason";

type CreateAdminSessionResult = {
  adminId?: string;
  sessionId?: string;
  role?: string;
  displayName?: string | null;
  expiresAt?: string;
};

function isAuthorized(request: Request) {
  const expected = process.env.PURE_BASIC_OWNER_SESSION_SECRET ?? "";
  const actual = request.headers.get(SESSION_SECRET_HEADER)?.trim() ?? "";
  // The shared helper compares fixed-length digests; the >= 32 policy keeps a
  // minimum secret entropy requirement on top of it.
  return expected.length >= 32 && safeSecretEqual(actual, expected);
}

/**
 * Shared-credential service sessions default to the historical 12h contract
 * and can only be shortened, never lengthened, via
 * PURE_BASIC_OWNER_SESSION_MINUTES.
 */
function ownerSessionMinutes() {
  const raw = process.env[OWNER_SESSION_MINUTES_ENV];

  if (raw === undefined) {
    return DEFAULT_OWNER_SESSION_MINUTES;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_OWNER_SESSION_MINUTES;
  }

  return Math.min(Math.max(parsed, MIN_OWNER_SESSION_MINUTES), MAX_OWNER_SESSION_MINUTES);
}

function readIssuanceReason(request: Request) {
  const reason = request.headers.get(SESSION_REASON_HEADER)?.trim();
  return reason && reason.length <= 200 ? reason : null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const requestId = getRequestId(request);
  const emailHash = hashAdminEmail(OWNER_EMAIL);
  const supabase = createSupabaseAdminClient();

  // The shared credential must never silently resurrect or re-promote the
  // synthetic principal: an operator deactivation or role change is an
  // explicit revocation that this endpoint must respect.
  const { data: existingAdmin, error: lookupError } = await supabase
    .from("admin_users")
    .select("id, role, active")
    .eq("email_hash", emailHash)
    .maybeSingle();

  if (lookupError) {
    logSafeError(
      { scope: "admin.session.basic_owner", stage: "admin_lookup", requestId },
      lookupError,
    );
    return NextResponse.json(
      { ok: false, error: "owner_session_create_failed" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  if (existingAdmin && (existingAdmin.active !== true || existingAdmin.role !== "owner")) {
    return NextResponse.json(
      { ok: false, error: "owner_session_principal_revoked" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  const token = createAdminSessionToken();
  const expiresAt = new Date(Date.now() + ownerSessionMinutes() * 60_000).toISOString();
  const { data, error } = await supabase.rpc("create_admin_session_v8", {
    p_email_hash: emailHash,
    p_display_name: "VIP Manager Owner",
    p_role: "owner",
    p_session_token_hash: hashAdminSessionToken(token),
    p_expires_at: expiresAt,
    p_request_id: requestId,
    p_provision: false,
    p_reason: null,
  });

  if (error) {
    logSafeError(
      { scope: "admin.session.basic_owner", stage: "create_session_rpc", requestId },
      error,
    );
    return NextResponse.json(
      { ok: false, error: "owner_session_create_failed" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const result = data as CreateAdminSessionResult | null;
  if (!result?.adminId || !result.sessionId || result.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "owner_session_create_failed" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  await recordAdminAuditEvent({
    actorAdminId: result.adminId,
    action: "admin_session.service_issue",
    requestId,
    reason: readIssuanceReason(request),
    afterJson: {
      sessionId: result.sessionId,
      servicePrincipal: OWNER_EMAIL,
      expiresAt: result.expiresAt ?? expiresAt,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      token,
      adminId: result.adminId,
      sessionId: result.sessionId,
      role: result.role,
      displayName: result.displayName ?? null,
      expiresAt: result.expiresAt ?? expiresAt,
      servicePrincipal: true,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
