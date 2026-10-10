import "server-only";

import { NextResponse } from "next/server";

import {
  VIP_FLOOR_ERROR_CODES,
  isRecord,
  type VipFloorAdminRole,
  type VipFloorCapability,
  type VipFloorErrorCode,
  type VipFloorRpcError,
  type VipFloorRpcResult,
} from "@/lib/vipFloorV2Contract";

import {
  ADMIN_SESSION_COOKIE_NAME,
  getRequestId,
  hashAdminSessionToken,
  type AdminActor,
} from "./adminAuth";
import { decryptCustomerProfileValue } from "./customerProfileCrypto";
import { recordVipManagerMetric } from "./vipManagerObservability";
import { isFeatureEnabled } from "./featureFlags";
import { createSupabaseAdminClient } from "./supabaseAdmin";

const ERROR_STATUS: Record<VipFloorErrorCode, number> = {
  INVALID_COMMAND: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  ADMIN_MUTATION_DISABLED: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  TABLE_TIME_CONFLICT: 409,
  BLOCK_CONFLICT: 409,
  TABLE_LOCKED: 409,
  INVALID_STATE_TRANSITION: 409,
  IDEMPOTENCY_MISMATCH: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  REFUND_PAYMENT_MISSING: 409,
  REFUND_AMOUNT_INVALID: 422,
  REFUND_BINDING_INVALID: 409,
  CAPACITY_WARNING_REQUIRES_OVERRIDE: 422,
  SLOT_COMPATIBILITY_MISSING: 409,
  OFFERING_TABLE_MISMATCH: 409,
};

const ROLE_CAPABILITIES: Record<VipFloorAdminRole, readonly VipFloorCapability[]> = {
  staff: [
    "floor.read",
    "customer.summary.masked",
  ],
  manager: [
    "floor.read",
    "customer.summary.masked",
  ],
  owner: [
    "floor.read",
    "customer.summary.masked",
    "customer.contact.read",
    "service_status.write",
    "reservation_note.write",
    "walk_in.create",
    "seat_extension.standard",
    "seat_extension.extended",
    "reservation_schedule.write",
    "reservation_assignment.write",
    "reservation_block.write",
    "reservation_cancel.write",
    "customer_profile.write",
  ],
  engineer: [
    "floor.read",
    "customer.summary.masked",
  ],
  accountant: [
    "floor.read",
    "customer.summary.masked",
  ],
};

const SAFE_ERROR_DETAIL_KEYS = new Set([
  "field",
  "reason",
  "entityType",
  "entity_type",
  "businessDate",
  "business_date",
  "currentVersion",
  "current_version",
  "expectedVersion",
  "expected_version",
  "boardRevision",
  "board_revision",
  "publicCode",
  "public_code",
  "conflictingPublicCode",
  "conflicting_public_code",
  "conflictingReservationPublicCode",
  "conflicting_reservation_public_code",
  "conflictingStartAt",
  "conflicting_start_at",
  "conflictingEndAt",
  "conflicting_end_at",
  "blockKind",
  "block_kind",
  "tableDisplayCode",
  "table_display_code",
  "scheduledStartAt",
  "scheduled_start_at",
  "scheduledEndAt",
  "scheduled_end_at",
  "assignedStartAt",
  "assigned_start_at",
  "assignedEndAt",
  "assigned_end_at",
  "capacityMin",
  "capacity_min",
  "capacityMax",
  "capacity_max",
  "guestCount",
  "guest_count",
  "combinedCapacity",
  "combined_capacity",
  "remainingRefundableAmountYen",
  "remaining_refundable_amount_yen",
  "remainingRefundableYen",
  "remaining_refundable_yen",
  "fromStatus",
  "from_status",
  "toStatus",
  "to_status",
  "overrideAllowed",
  "override_allowed",
  "reasonRequired",
  "reason_required",
  "occurredAt",
  "occurred_at",
  "candidateCount",
  "candidate_count",
  "capability",
]);

const LOG_SENSITIVE_KEY_PATTERN =
  /(?:name|kana|email|phone|contact|line|allerg|preference|note|memo|reasonNote|guestLabel|operatorNote|ciphertext|nonce|authTag|secret|token|password|cookie|authorization|apiKey|clientSecret|stripe|provider|webhook|payload|raw)/i;

export type VipFloorReadAuthorization =
  | { ok: true; actor: AdminActor }
  | { ok: false; response: NextResponse };

type AuthenticateAdminResult = {
  adminId?: string;
  sessionId?: string;
  role?: string;
  displayName?: string | null;
  requestId?: string;
};

export async function requireVipFloorV2AdminSession(
  request: Request,
): Promise<VipFloorReadAuthorization> {
  const token = readAdminSessionToken(request);

  if (!token) {
    return { ok: false, response: createVipFloorErrorResponse({ code: "UNAUTHENTICATED" }) };
  }

  const requestId = getRequestId(request);
  const { data, error } = await createSupabaseAdminClient().rpc("authenticate_admin_session_v7", {
    p_session_token_hash: hashAdminSessionToken(token),
    p_request_id: requestId,
  });

  if (error) {
    logVipFloorServerEvent("vip_floor_admin_session_auth_failed", { requestId });
    return { ok: false, response: createVipFloorErrorResponse({ code: "UNAUTHENTICATED" }) };
  }

  const result = data as AuthenticateAdminResult | null;

  if (!result?.adminId || !result.sessionId || !result.role) {
    return { ok: false, response: createVipFloorErrorResponse({ code: "UNAUTHENTICATED" }) };
  }

  return {
    ok: true,
    actor: {
      adminId: result.adminId,
      sessionId: result.sessionId,
      role: result.role,
      displayName: result.displayName ?? null,
      requestId: result.requestId ?? requestId,
    },
  };
}

export async function requireVipFloorV2Read(request: Request): Promise<VipFloorReadAuthorization> {
  const auth = await requireVipFloorV2AdminSession(request);

  if (!auth.ok) {
    return auth;
  }

  if (!isFeatureEnabled("FEATURE_VIP_FLOOR_V2_READ_ENABLED")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "vip_floor_v2_read_disabled" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, actor: auth.actor };
}

export async function readVipFloorBoardV2(actor: AdminActor, businessDate: string) {
  const rpcStartedAt = performance.now();
  const { data, error } = await createSupabaseAdminClient().rpc("get_admin_vip_floor_board_v22", {
    p_actor_admin_id: actor.adminId,
    p_business_date: businessDate,
  });

  if (error) {
    await recordVipManagerMetric({
      metricName: "board_read",
      outcome: "error",
      durationMs: performance.now() - rpcStartedAt,
      actionName: "board.read",
      requestId: actor.requestId,
    });
    logVipFloorServerEvent("vip_floor_board_rpc_failed", {
      requestId: actor.requestId,
      adminId: actor.adminId,
    });
    return createInternalErrorResponse("vip_floor_v2_read_failed");
  }

  const rejected = mapVipFloorRpcRejection(data);

  if (rejected) {
    await recordVipManagerMetric({
      metricName: "board_read",
      outcome: "rejected",
      durationMs: performance.now() - rpcStartedAt,
      actionName: "board.read",
      requestId: actor.requestId,
    });
    return rejected;
  }

  const payload = unwrapRpcPayload(data);

  if (
    isRecord(payload)
    && payload.action === "day_state"
    && payload.schemaVersion === "vip-floor-day-state.v1"
    && payload.businessDate === businessDate
    && (payload.state === "missing" || payload.state === "closed")
  ) {
    return NextResponse.json({
      ok: false,
      error: payload.state === "closed" ? "event_day_closed" : "event_day_not_found",
      dayState: {
        state: payload.state,
        businessDate,
        reason: typeof payload.reason === "string" ? payload.reason : null,
      },
    }, { status: payload.state === "closed" ? 409 : 404 });
  }

  if (
    !isRecord(payload) ||
    payload.action !== "resolved" ||
    payload.schemaVersion !== "vip-floor.v2"
  ) {
    await recordVipManagerMetric({
      metricName: "board_read",
      outcome: "error",
      durationMs: performance.now() - rpcStartedAt,
      actionName: "board.read",
      requestId: actor.requestId,
    });
    logVipFloorServerEvent("vip_floor_board_rpc_invalid_result", {
      requestId: actor.requestId,
      adminId: actor.adminId,
    });
    return createInternalErrorResponse("vip_floor_v2_read_failed");
  }

  const role = readAdminRole(actor.role);
  const capabilities = getVipFloorCapabilities(role);
  const { action: _action, revision: _revision, ...boardPayload } = payload;
  void _action;
  void _revision;
  const managerBoard = filterConfirmedVipManagerBoard(boardPayload, role);
  const board = sanitizeVipFloorClientPayload({
    ...managerBoard,
    capabilities: {
      readCustomerPii: capabilities.has("customer.contact.read"),
      changeServiceStatus: capabilities.has("service_status.write"),
      changeAssignments: capabilities.has("reservation_assignment.write"),
      changeSchedule: capabilities.has("reservation_schedule.write"),
      manageBlocks: capabilities.has("reservation_block.write"),
      cancelReservation: capabilities.has("reservation_cancel.write"),
    },
    operations: {
      adminMutationEnabled:
        isFeatureEnabled("FEATURE_ADMIN_MUTATION_ENABLED") &&
        isFeatureEnabled("FEATURE_VIP_FLOOR_V2_MUTATION_ENABLED"),
      webhookProcessingEnabled: isFeatureEnabled("FEATURE_WEBHOOK_PROCESSING_ENABLED"),
      publicBookingEnabled: isFeatureEnabled("FEATURE_PUBLIC_BOOKING_ENABLED"),
    },
  });

  await recordVipManagerMetric({
    metricName: "board_read",
    outcome: "success",
    durationMs: performance.now() - rpcStartedAt,
    actionName: "board.read",
    requestId: actor.requestId,
  });
  return NextResponse.json({ ok: true, ...(board as Record<string, unknown>) });
}

export async function readVipFloorRevisionV2(actor: AdminActor, businessDate: string) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "get_admin_vip_floor_revision_v22",
    {
      p_actor_admin_id: actor.adminId,
      p_business_date: businessDate,
    },
  );

  if (error) {
    logVipFloorServerEvent("vip_floor_revision_rpc_failed", {
      requestId: actor.requestId,
      adminId: actor.adminId,
    });
    return createInternalErrorResponse("vip_floor_revision_read_failed");
  }

  const rejected = mapVipFloorRpcRejection(data);

  if (rejected) {
    return rejected;
  }

  const payload = unwrapRpcPayload(data);

  if (
    isRecord(payload)
    && payload.action === "day_state"
    && payload.schemaVersion === "vip-floor-day-state.v1"
    && payload.businessDate === businessDate
    && (payload.state === "missing" || payload.state === "closed")
  ) {
    return NextResponse.json({
      ok: true,
      businessDate,
      dayState: {
        state: payload.state,
        businessDate,
        reason: typeof payload.reason === "string" ? payload.reason : null,
      },
    });
  }
  const revision = isRecord(payload)
    ? readSafeResponseInteger(payload.revision)
    : null;

  if (
    !isRecord(payload)
    || payload.action !== "resolved"
    || payload.schemaVersion !== "vip-floor-revision.v1"
    || payload.businessDate !== businessDate
    || revision === null
  ) {
    logVipFloorServerEvent("vip_floor_revision_rpc_invalid_result", {
      requestId: actor.requestId,
      adminId: actor.adminId,
    });
    return createInternalErrorResponse("vip_floor_revision_read_failed");
  }

  return NextResponse.json({
    ok: true,
    businessDate,
    revision,
  });
}

export async function readVipFloorCustomerV2(actor: AdminActor, customerId: string) {
  if (!actorHasVipFloorCapability(actor.role, "customer.contact.read")) {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: "customer.contact.read" },
    });
  }

  const { data, error } = await createSupabaseAdminClient().rpc("get_admin_customer_profile_v14", {
    p_actor_admin_id: actor.adminId,
    p_customer_id: customerId,
  });

  if (error) {
    logVipFloorServerEvent("vip_floor_customer_rpc_failed", {
      requestId: actor.requestId,
      adminId: actor.adminId,
      customerId,
    });
    return createInternalErrorResponse("vip_floor_customer_read_failed");
  }

  const rejected = mapVipFloorRpcRejection(data);

  if (rejected) {
    return rejected;
  }

  const payload = unwrapRpcPayload(data);

  if (
    !isRecord(payload) ||
    payload.action !== "resolved" ||
    payload.schemaVersion !== "vip-customer.v2" ||
    !isRecord(payload.customer)
  ) {
    logVipFloorServerEvent("vip_floor_customer_rpc_invalid_result", {
      requestId: actor.requestId,
      adminId: actor.adminId,
      customerId,
    });
    return createInternalErrorResponse("vip_floor_customer_read_failed");
  }

  try {
    const customer = decryptCustomerProfileRecord(payload.customer);
    const response = sanitizeVipFloorClientPayload({
      schemaVersion: payload.schemaVersion,
      generatedAt: payload.generatedAt,
      customer,
      accessAuditRecorded: payload.accessAuditRecorded === true,
    }, {
      allowCustomerPii: true,
    });
    return NextResponse.json({ ok: true, ...(response as Record<string, unknown>) });
  } catch {
    logVipFloorServerEvent("vip_floor_customer_decrypt_failed", {
      requestId: actor.requestId,
      adminId: actor.adminId,
      customerId,
    });
    return createInternalErrorResponse("vip_floor_customer_read_failed");
  }
}

export function getVipFloorCapabilities(role: VipFloorAdminRole) {
  return new Set(ROLE_CAPABILITIES[role]);
}

export function actorHasVipFloorCapability(
  role: string,
  capability: VipFloorCapability,
) {
  return getVipFloorCapabilities(readAdminRole(role)).has(capability);
}

export function filterConfirmedVipManagerBoard(
  payload: Record<string, unknown>,
  role: VipFloorAdminRole,
) {
  const reservations = readRecordArray(payload.reservations)
    .filter((reservation) => reservation.lifecycleStatus === "confirmed")
    .map((reservation) => maskBoardReservation(reservation, role));
  const reservationIds = new Set(
    reservations
      .map((reservation) => reservation.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const assignments = readRecordArray(payload.assignments)
    .filter((assignment) => (
      typeof assignment.reservationId === "string"
      && reservationIds.has(assignment.reservationId)
    ));
  const unassignedReservationIds = Array.isArray(payload.unassignedReservationIds)
    ? payload.unassignedReservationIds.filter(
      (reservationId): reservationId is string => (
        typeof reservationId === "string"
        && reservationIds.has(reservationId)
      ),
    )
    : [];
  const tables = readRecordArray(payload.tables).map((table) => ({
    ...table,
    reservationIds: Array.isArray(table.reservationIds)
      ? table.reservationIds.filter(
        (reservationId): reservationId is string => (
          typeof reservationId === "string"
          && reservationIds.has(reservationId)
        ),
      )
      : [],
  }));
  const notes = role === "owner"
    ? readRecordArray(payload.notes).filter((note) => (
      typeof note.reservationId === "string"
      && reservationIds.has(note.reservationId)
    ))
    : [];
  const activeReservations = reservations.filter(
    (reservation) => !["completed", "no_show"].includes(
      typeof reservation.serviceStatus === "string"
        ? reservation.serviceStatus
        : "",
    ),
  );
  const serviceStatusCounts: Record<string, number> = {};
  for (const reservation of reservations) {
    const key = typeof reservation.serviceStatus === "string"
      ? reservation.serviceStatus
      : "not_set";
    serviceStatusCounts[key] = (serviceStatusCounts[key] ?? 0) + 1;
  }
  const guestCount = activeReservations.reduce((total, reservation) => {
    const value = isRecord(reservation.guestCount)
      ? reservation.guestCount.total
      : null;
    return total + (
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : 0
    );
  }, 0);
  const sourceTotals = isRecord(payload.totals) ? payload.totals : {};

  return {
    ...payload,
    reservations,
    assignments,
    unassignedReservationIds,
    tables,
    notes,
    totals: {
      ...sourceTotals,
      tableCount: tables.length,
      reservationCount: reservations.length,
      activeReservationCount: activeReservations.length,
      assignmentCount: assignments.length,
      unassignedReservationCount: unassignedReservationIds.length,
      noteCount: notes.length,
      guestCount,
      serviceStatusCounts,
    },
  };
}

export function mapVipFloorRpcRejection(data: unknown) {
  if (!isRecord(data) || data.action !== "rejected") {
    return null;
  }

  const rpcError = normalizeRpcError(data.error);

  if (!rpcError) {
    return createInternalErrorResponse("vip_floor_command_failed");
  }

  return createVipFloorErrorResponse(rpcError);
}

export function createVipFloorErrorResponse(error: VipFloorRpcError) {
  const details = sanitizeRpcErrorDetails(error.details);
  const currentVersion = readSafeResponseInteger(error.currentVersion);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        ...(currentVersion === null ? {} : { currentVersion }),
        ...(details ? { details } : {}),
      },
    },
    { status: ERROR_STATUS[error.code] },
  );
}

export function createInvalidCommandResponse(field?: string) {
  return createVipFloorErrorResponse({
    code: "INVALID_COMMAND",
    ...(field ? { details: { field } } : {}),
  });
}

export function sanitizeVipFloorClientPayload(
  value: unknown,
  options: { allowCustomerPii?: boolean } = {},
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeVipFloorClientPayload(item, options));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isForbiddenClientKey(key)) {
      continue;
    }

    if (!options.allowCustomerPii && /^(?:email|phone|nameKana|contact)$/i.test(key)) {
      continue;
    }

    sanitized[key] = sanitizeVipFloorClientPayload(nestedValue, options);
  }

  return sanitized;
}

export function redactVipFloorLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(redactVipFloorLogValue);
  }

  if (!isRecord(value)) {
    return typeof value === "string" && value.length > 256 ? `${value.slice(0, 256)}…` : value;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = LOG_SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : redactVipFloorLogValue(nestedValue);
  }

  return redacted;
}

export function logVipFloorServerEvent(event: string, context: Record<string, unknown>) {
  console.warn(event, redactVipFloorLogValue(context));
}

export function isVipFloorRpcResult(value: unknown): value is VipFloorRpcResult {
  return isRecord(value);
}

function normalizeRpcError(value: unknown): VipFloorRpcError | null {
  if (!isRecord(value) || !isVipFloorErrorCode(value.code)) {
    return null;
  }

  const currentVersion = readSafeResponseInteger(value.currentVersion ?? value.current_version);

  return {
    code: value.code,
    ...(currentVersion === null ? {} : { currentVersion }),
    ...(isRecord(value.details) ? { details: value.details } : {}),
  };
}

function sanitizeRpcErrorDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return null;
  }

  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(details)) {
    if (
      SAFE_ERROR_DETAIL_KEYS.has(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null)
    ) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

function unwrapRpcPayload(data: unknown) {
  return isRecord(data) && isRecord(data.response) ? data.response : data;
}

function decryptCustomerProfileRecord(customer: Record<string, unknown>) {
  if (!isRecord(customer.ciphertext)) {
    throw new Error("invalid_customer_profile_ciphertext");
  }

  const ciphertext = customer.ciphertext;
  const decrypted: Record<string, unknown> = {};

  for (const field of [
    "displayName",
    "nameKana",
    "phone",
    "email",
    "allergies",
    "preferences",
  ] as const) {
    const value = ciphertext[field];
    decrypted[field] = value === null ? null : decryptCustomerProfileValue(readCiphertext(value));
  }

  const { ciphertext: _ciphertext, ...safeCustomer } = customer;
  void _ciphertext;
  return { ...safeCustomer, ...decrypted };
}

function readCiphertext(value: unknown) {
  if (typeof value === "string" || value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return value;
  }

  throw new Error("invalid_customer_profile_ciphertext");
}

function createInternalErrorResponse(code: string) {
  return NextResponse.json({ ok: false, error: { code } }, { status: 500 });
}

function isVipFloorErrorCode(value: unknown): value is VipFloorErrorCode {
  return typeof value === "string" && VIP_FLOOR_ERROR_CODES.includes(value as VipFloorErrorCode);
}

function readSafeResponseInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function readAdminRole(value: string): VipFloorAdminRole {
  return ["staff", "manager", "owner", "engineer", "accountant"].includes(value)
    ? (value as VipFloorAdminRole)
    : "accountant";
}

function readRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function maskBoardReservation(
  reservation: Record<string, unknown>,
  role: VipFloorAdminRole,
) {
  if (role === "owner") {
    return reservation;
  }

  const publicCode = typeof reservation.publicCode === "string"
    ? reservation.publicCode
    : "";
  return {
    ...reservation,
    notes: [],
    customer: isRecord(reservation.customer)
      ? {
        displayLabel: `Guest ***${publicCode.slice(-2)}`,
        masked: true,
      }
      : null,
  };
}

function readAdminSessionToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearerToken) {
    return bearerToken;
  }

  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const segment of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = segment.trim().split("=");

    if (rawKey === ADMIN_SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function isForbiddenClientKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "password" ||
    normalized === "apikey" ||
    normalized === "clientsecret" ||
    normalized === "ciphertext" ||
    normalized === "nonce" ||
    normalized === "authtag" ||
    normalized === "token" ||
    normalized === "raw" ||
    normalized === "payload" ||
    normalized.includes("providerobjectid") ||
    normalized.includes("stripecustomerid") ||
    normalized.includes("stripesecret") ||
    normalized.includes("webhooksecret") ||
    normalized.includes("rawpayload")
  );
}
