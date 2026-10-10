import { VIP_MANAGER_ERROR_CODES } from "@/generated/vipManagerRuntimeContract";

export const VIP_FLOOR_SCHEMA_VERSION = "vip-floor.v2" as const;
export const VIP_MANAGER_FIXED_AUDIT_REASON = "管理画面操作" as const;

export const VIP_SERVICE_STATUSES = [
  "expected",
  "late",
  "no_contact",
  "arrived",
  "partial_arrival",
  "seated",
  "bottle_pending",
  "bottle_served",
  "bill_requested",
  "paid",
  "resetting",
  "completed",
  "no_show",
] as const;

export type VipServiceStatus = (typeof VIP_SERVICE_STATUSES)[number];

export const VIP_FLOOR_CAPABILITIES = [
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
] as const;

export type VipFloorCapability = (typeof VIP_FLOOR_CAPABILITIES)[number];

export const VIP_FLOOR_ERROR_CODES = VIP_MANAGER_ERROR_CODES;

export type VipFloorErrorCode = (typeof VIP_FLOOR_ERROR_CODES)[number];
export type VipFloorAdminRole = "staff" | "manager" | "owner" | "engineer" | "accountant";
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type VipFloorRpcError = {
  code: VipFloorErrorCode;
  currentVersion?: number;
  details?: Record<string, unknown>;
};

export type VipFloorRpcResult = {
  [key: string]: unknown;
  action?: string;
  reused?: boolean;
  response?: Record<string, unknown> | null;
  error?: VipFloorRpcError | string | null;
  entityVersion?: number;
  currentVersion?: number;
  boardRevision?: number;
  auditLogId?: string;
};

export type VipFloorCommandResult = {
  ok: true;
  action: string;
  reused: boolean;
  entityVersion: number;
  boardRevision: number;
  auditLogId: string;
};

export type VipFloorBoardV2 = {
  schemaVersion: typeof VIP_FLOOR_SCHEMA_VERSION;
  generatedAt: string;
  boardRevision: number;
  businessDay: {
    id: string;
    businessDate: string;
    venueTimezone: "Asia/Tokyo";
    operatingStartAt: string;
    operatingEndAt: string;
  };
  capabilities: {
    readCustomerPii: boolean;
    changeServiceStatus: boolean;
    changeAssignments: boolean;
    changeSchedule: boolean;
    manageBlocks: boolean;
    cancelReservation: boolean;
  };
  sections: FloorSectionV2[];
  tables: VipTableV2[];
  reservations: VipFloorReservationV2[];
  assignments: VipFloorAssignmentV2[];
  unassignedReservationIds: string[];
  blocks: ReservationBlockV2[];
  notes: ReservationNoteSummaryV2[];
  totals: VipFloorTotalsV2;
  operations: {
    adminMutationEnabled: boolean;
    webhookProcessingEnabled: boolean;
    publicBookingEnabled: boolean;
  };
  legacyFallbackCount?: number;
};

export type FloorSectionV2 = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type VipTableV2 = {
  id: string;
  version: number;
  publicResourceCode: string | null;
  displayCode: string;
  name: string;
  sectionId: string;
  capacityMin: number;
  capacityMax: number;
  onlineEligible: boolean | null;
  geometry: {
    shape: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
    rotationDegrees: number;
  };
  operationalLocked: boolean;
  lockReason: string | null;
  reservationIds: string[];
  blockIds: string[];
};

export type VipFloorReservationV2 = {
  id: string;
  version: number;
  publicCode: string;
  businessDate: string;
  lifecycleStatus: string;
  serviceStatus: VipServiceStatus | null;
  sourceChannel: "online" | "phone" | "walk_in" | "admin";
  scheduledStartAt: string;
  scheduledEndAt: string;
  expectedReleaseAt: string;
  actualSeatedAt: string | null;
  completedAt: string | null;
  guestCount: { total: number; adults: number | null; children: number | null };
  assignmentIds: string[];
  tableIds: string[];
  customer: Record<string, unknown> | null;
  payment: Record<string, unknown> | null;
  notes: Record<string, unknown>[];
  flags: string[];
  bookingOfferingId?: string | null;
  bookingStaffMemberId?: string | null;
  notificationPreference?: "none" | "email";
  operatorNote?: string | null;
  updatedAt: string;
};

export type ReservationBlockV2 = {
  id: string;
  version: number;
  scope: "online_only" | "all_operations";
  kind: string;
  startAt: string;
  endAt: string;
  memo: string | null;
  targets: {
    venueWide: boolean;
    sectionIds: string[];
    tableIds: string[];
  };
  updatedAt: string;
};

export type VipFloorAssignmentV2 = {
  id: string;
  version: number;
  reservationId: string;
  tableId: string;
  lockStatus: string;
  assignmentRole: string | null;
  startAt: string;
  endAt: string;
  updatedAt: string;
};

export type ReservationNoteSummaryV2 = {
  id: string;
  reservationId: string;
  kind: "floor" | "booking" | "private";
  body: string;
  pinned: boolean;
  version: number;
  updatedAt: string;
};

export type VipFloorTotalsV2 = {
  tableCount: number;
  reservationCount: number;
  activeReservationCount: number;
  assignmentCount: number;
  unassignedReservationCount: number;
  activeBlockCount: number;
  noteCount: number;
  guestCount: number;
  serviceStatusCounts: Record<string, number>;
};

export type AdminCommand = {
  expectedVersion: number;
  reason: string | null;
};

export type ScheduleCommand = AdminCommand & {
  scheduledStartAt: string;
  scheduledEndAt: string;
};

export type AssignmentCommand = AdminCommand & {
  operation: "replace" | "add" | "remove" | "unassign";
  tableIds: string[];
  reopenOnlineInventory?: boolean;
  capacityOverride: boolean;
};

export type ServiceStatusCommand = AdminCommand & {
  toStatus: VipServiceStatus;
  occurredAt: string;
};

export type SeatExtensionCommand = AdminCommand & {
  extendMinutes: number;
};

export type ConfirmationCommand = AdminCommand;

export type CheckInCommand = AdminCommand & {
  occurredAt: string;
};

export type ArrivalTimeCommand = AdminCommand & {
  arrivedAt: string;
};

export type CancellationCommand = {
  expectedVersion: number;
  reasonCode: "customer_request" | "duplicate" | "venue_decision" | "no_contact" | "other";
  reasonNote: string | null;
  refundDecision: "none" | "full" | "partial" | "review";
  refundAmountYen: number | null;
  notifyCustomer: boolean;
};

export type ReservationNoteCommand = AdminCommand & {
  noteId: string | null;
  expectedNoteVersion: number | null;
  kind: "floor" | "booking" | "private";
  body: string;
  pinned: boolean;
};

export type WalkInTableVersion = {
  tableId: string;
  expectedVersion: number;
};

export type WalkInCommand = {
  eventDayId: string;
  offeringId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  guestCount: number;
  tableIds: string[];
  guestLabel: string | null;
  operatorNote: string | null;
  bookingStaffMemberId: string | null;
  expectedTableVersions: WalkInTableVersion[];
  capacityOverride: boolean;
  reason: string | null;
};

export type ReservationCreateCommand = {
  eventDayId: string;
  offeringId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  guestCount: number;
  tableIds: string[];
  expectedTableVersions: WalkInTableVersion[];
  existingCustomerId: string | null;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  languageCode: string | null;
  guestLabel: string | null;
  operatorNote: string | null;
  sourceChannel: "online" | "phone" | "admin";
  serviceStatus: VipServiceStatus;
  bookingStaffMemberId: string | null;
  notificationPreference: "none" | "email";
  capacityOverride: boolean;
  reason: string;
};

export type ReservationUpdateCommand = {
  expectedVersion: number;
  offeringId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  guestCount: number;
  tableIds: string[];
  expectedTableVersions: WalkInTableVersion[];
  guestLabel: string | null;
  operatorNote: string | null;
  sourceChannel: "online" | "phone" | "admin";
  serviceStatus: VipServiceStatus;
  bookingStaffMemberId: string | null;
  notificationPreference: "none" | "email";
  capacityOverride: boolean;
  reason: string;
};

export type ReservationCustomerRelinkCommand = {
  expectedVersion: number;
  customerId: string | null;
  reason: typeof VIP_MANAGER_FIXED_AUDIT_REASON;
};

export type VipBlockFields = {
  scope: "online_only" | "all_operations";
  kind: "manual" | "maintenance" | "owner_hold" | "event" | "unassignment_guard";
  startAt: string;
  endAt: string;
  memo: string | null;
  seatResourceIds: string[];
  floorSectionIds: string[];
  venueWide: boolean;
  reason: string | null;
};

export type VipBlockCreateCommand = VipBlockFields & {
  eventDayId: string;
};

export type VipBlockUpdateCommand = AdminCommand & VipBlockFields;

export type CustomerProfileCommand = {
  expectedVersion: number | null;
  eventDayId: string;
  reservationId: string | null;
  displayName: string | null;
  nameKana: string | null;
  phone: string | null;
  email: string | null;
  languageCode: string | null;
  allergies: string | null;
  preferences: string | null;
  reason: string | null;
};

export type CustomerAttributesCommand = {
  expectedVersion: number;
  eventDayId: string;
  reservationId: string;
  nationalityCode: string | null;
  birthDate: string | null;
  anniversaryDate: string | null;
  vipRank: string | null;
  reason: typeof VIP_MANAGER_FIXED_AUDIT_REASON;
};

export type EmailNotificationCommand = AdminCommand & {
  template:
    | "reservation_created"
    | "reservation_changed"
    | "waitlist_called"
    | "waitlist_recalled";
};

export class VipFloorContractError extends Error {
  readonly code = "INVALID_COMMAND" as const;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "VipFloorContractError";
    this.field = field;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export function readStrictUuid(value: unknown, field = "id") {
  if (typeof value !== "string" || value !== value.trim() || !UUID_PATTERN.test(value)) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readBusinessDate(value: unknown, field = "businessDate") {
  if (typeof value !== "string" || value !== value.trim()) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const match = BUSINESS_DATE_PATTERN.exec(value);

  if (!match) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readIsoTimestamp(value: unknown, field: string) {
  if (typeof value !== "string" || value !== value.trim()) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const match = TIMESTAMP_PATTERN.exec(value);

  if (!match) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  readBusinessDate(match[1], field);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4]);
  const offset = match[5];

  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  if (offset !== "Z") {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4, 6));

    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) {
      throw new VipFloorContractError(`Invalid ${field}`, field);
    }
  }

  if (!Number.isFinite(Date.parse(value))) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readExpectedVersion(value: unknown, field = "expectedVersion") {
  return readSafeInteger(value, field, 1, Number.MAX_SAFE_INTEGER);
}

export function readSafeInteger(value: unknown, field: string, minimum: number, maximum: number) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readStrictObject(value: unknown, allowedKeys: readonly string[], field = "body") {
  if (!isRecord(value)) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new VipFloorContractError(`Unknown ${field} field`, key);
    }
  }

  return value;
}

export function readBoundedString(
  value: unknown,
  field: string,
  options: { minimum?: number; maximum: number; nullable: true },
): string | null;
export function readBoundedString(
  value: unknown,
  field: string,
  options: { minimum?: number; maximum: number; nullable?: false },
): string;
export function readBoundedString(
  value: unknown,
  field: string,
  options: { minimum?: number; maximum: number; nullable?: boolean },
) {
  if (value === null && options.nullable) {
    return null;
  }

  if (typeof value !== "string" || value !== value.trim()) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const minimum = options.minimum ?? 1;

  if (value.length < minimum || value.length > options.maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value;
}

export function readStringEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  return value as T[number];
}

export function readUuidArray(value: unknown, field: string, options: { minimum?: number; maximum?: number } = {}) {
  if (!Array.isArray(value)) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 100;

  if (value.length < minimum || value.length > maximum) {
    throw new VipFloorContractError(`Invalid ${field}`, field);
  }

  const ids = value.map((item) => readStrictUuid(item, field));

  if (new Set(ids).size !== ids.length) {
    throw new VipFloorContractError(`Duplicate ${field}`, field);
  }

  return [...ids].sort();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
