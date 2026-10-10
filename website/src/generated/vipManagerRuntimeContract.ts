// Generated from contracts/vip-manager/v2/runtime-contract.json. Do not edit by hand.
export const VIP_MANAGER_RUNTIME_CONTRACT = {
  "contractVersion": "ghost.vip-manager.v2.1",
  "authentication": {
    "productionAuthority": "basic-only",
    "productionPinAllowed": false,
    "demoPinAllowed": true,
    "sessionCookie": "pure_admin_session",
    "initialMutationRole": "owner"
  },
  "idempotencyKey": {
    "minimumLength": 8,
    "maximumLength": 128,
    "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
  },
  "businessDays": {
    "method": "GET",
    "backendPath": "/api/admin/v2/vip-floor/business-days",
    "consumerPath": "/api/admin/vip-floor/business-days",
    "backendQuery": [
      "afterBusinessDate",
      "limit"
    ],
    "consumerQuery": [
      "after",
      "limit"
    ],
    "maximumSuggestions": 3,
    "initialRole": "owner",
    "successFields": [
      "ok",
      "businessDates"
    ]
  },
  "dayState": {
    "schemaVersion": "vip-floor-day-state.v1",
    "states": [
      "missing",
      "open",
      "closed"
    ],
    "closedReasonRequired": true
  },
  "reservationProvenance": {
    "values": [
      "online",
      "phone",
      "walk_in",
      "admin"
    ],
    "legacyAdminHoldMapsTo": "admin"
  },
  "sharedMemo": {
    "authority": "reservation_notes",
    "kind": "floor",
    "legacyOperatorNote": "compatibility-projection"
  },
  "errorCodes": [
    "INVALID_COMMAND",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "ADMIN_MUTATION_DISABLED",
    "NOT_FOUND",
    "VERSION_CONFLICT",
    "TABLE_TIME_CONFLICT",
    "BLOCK_CONFLICT",
    "TABLE_LOCKED",
    "INVALID_STATE_TRANSITION",
    "IDEMPOTENCY_MISMATCH",
    "IDEMPOTENCY_IN_PROGRESS",
    "REFUND_PAYMENT_MISSING",
    "REFUND_AMOUNT_INVALID",
    "REFUND_BINDING_INVALID",
    "CAPACITY_WARNING_REQUIRES_OVERRIDE",
    "SLOT_COMPATIBILITY_MISSING",
    "OFFERING_TABLE_MISMATCH"
  ],
  "businessDayEnsure": {
    "method": "POST",
    "backendPath": "/api/admin/v2/vip-floor/business-days",
    "consumerPath": "/api/admin/vip-floor/business-days",
    "initialRole": "owner",
    "requestFields": [
      "businessDate",
      "reason"
    ],
    "successFields": [
      "ok",
      "action",
      "reused",
      "entityVersion",
      "boardRevision",
      "auditLogId",
      "eventDayId",
      "businessDate",
      "created",
      "slotsCreated",
      "operatingStatus"
    ],
    "errorCodes": [
      "INVALID_COMMAND",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "ADMIN_MUTATION_DISABLED",
      "IDEMPOTENCY_MISMATCH",
      "IDEMPOTENCY_IN_PROGRESS"
    ]
  }
} as const;

export const VIP_MANAGER_ERROR_CODES = VIP_MANAGER_RUNTIME_CONTRACT.errorCodes;
export const VIP_MANAGER_MAX_BUSINESS_DAY_SUGGESTIONS = VIP_MANAGER_RUNTIME_CONTRACT.businessDays.maximumSuggestions;
export const VIP_MANAGER_RESERVATION_PROVENANCE = VIP_MANAGER_RUNTIME_CONTRACT.reservationProvenance.values;

export function isValidVipManagerIdempotencyKey(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= VIP_MANAGER_RUNTIME_CONTRACT.idempotencyKey.minimumLength
    && value.length <= VIP_MANAGER_RUNTIME_CONTRACT.idempotencyKey.maximumLength
    && new RegExp(VIP_MANAGER_RUNTIME_CONTRACT.idempotencyKey.pattern, "u").test(value);
}

export function readVipManagerBusinessDates(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || !Array.isArray(payload.businessDates)) return null;
  if (payload.businessDates.length > VIP_MANAGER_MAX_BUSINESS_DAY_SUGGESTIONS) return null;
  if (!payload.businessDates.every((date) => typeof date === "string")) return null;
  return payload.businessDates as string[];
}

export type VipManagerBusinessDayEnsure = {
  action: "business_day.ensured";
  reused: boolean;
  entityVersion: number;
  boardRevision: number;
  auditLogId: string;
  eventDayId: string;
  businessDate: string;
  created: boolean;
  slotsCreated: number;
  operatingStatus: "open" | "closed";
};

export function readVipManagerBusinessDayEnsure(
  value: unknown,
): VipManagerBusinessDayEnsure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true) return null;
  if (payload.action !== "business_day.ensured") return null;
  if (typeof payload.reused !== "boolean") return null;
  if (
    typeof payload.entityVersion !== "number"
    || !Number.isSafeInteger(payload.entityVersion)
    || payload.entityVersion < 1
  ) return null;
  if (
    typeof payload.boardRevision !== "number"
    || !Number.isSafeInteger(payload.boardRevision)
    || payload.boardRevision < 0
  ) return null;
  if (
    typeof payload.auditLogId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(payload.auditLogId)
  ) return null;
  if (typeof payload.eventDayId !== "string") return null;
  if (typeof payload.businessDate !== "string") return null;
  if (typeof payload.created !== "boolean") return null;
  if (
    typeof payload.slotsCreated !== "number"
    || !Number.isSafeInteger(payload.slotsCreated)
    || payload.slotsCreated < 0
  ) return null;
  if (payload.operatingStatus !== "open" && payload.operatingStatus !== "closed") return null;
  return {
    action: payload.action,
    reused: payload.reused,
    entityVersion: payload.entityVersion,
    boardRevision: payload.boardRevision,
    auditLogId: payload.auditLogId,
    eventDayId: payload.eventDayId,
    businessDate: payload.businessDate,
    created: payload.created,
    slotsCreated: payload.slotsCreated,
    operatingStatus: payload.operatingStatus,
  };
}

export function isVipManagerReservationProvenance(
  value: unknown,
): value is (typeof VIP_MANAGER_RESERVATION_PROVENANCE)[number] {
  return typeof value === "string"
    && VIP_MANAGER_RESERVATION_PROVENANCE.includes(
      value as (typeof VIP_MANAGER_RESERVATION_PROVENANCE)[number],
    );
}
