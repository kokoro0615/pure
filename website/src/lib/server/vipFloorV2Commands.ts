import "server-only";

import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { isValidVipManagerIdempotencyKey } from "@/generated/vipManagerRuntimeContract";

import {
  VIP_MANAGER_FIXED_AUDIT_REASON,
  VIP_SERVICE_STATUSES,
  VipFloorContractError,
  isRecord,
  readBoolean,
  readBusinessDate,
  readBoundedString,
  readExpectedVersion,
  readIsoTimestamp,
  readSafeInteger,
  readStrictUuid,
  readStrictObject,
  readStringEnum,
  readUuidArray,
  type JsonValue,
  type AssignmentCommand,
  type ArrivalTimeCommand,
  type CancellationCommand,
  type CheckInCommand,
  type ConfirmationCommand,
  type CustomerProfileCommand,
  type CustomerAttributesCommand,
  type EmailNotificationCommand,
  type ReservationNoteCommand,
  type ReservationCreateCommand,
  type ReservationCustomerRelinkCommand,
  type ReservationUpdateCommand,
  type ScheduleCommand,
  type ServiceStatusCommand,
  type SeatExtensionCommand,
  type VipBlockCreateCommand,
  type VipBlockFields,
  type VipBlockUpdateCommand,
  type WalkInCommand,
  type WalkInTableVersion,
  type VipFloorRpcResult,
  type VipFloorCapability,
} from "@/lib/vipFloorV2Contract";

import { adminActionRequestHash } from "./adminAuth";
import {
  assertAdminCookieMutation,
  isHttpBodyError,
  readBoundedText,
} from "./httpBoundary";
import {
  CustomerProfileCryptoError,
  createCustomerProfileRequestFingerprint,
  createCustomerProfileSearchToken,
  packCustomerProfileValueForPostgres,
} from "./customerProfileCrypto";
import { isFeatureEnabled } from "./featureFlags";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  actorHasVipFloorCapability,
  createInvalidCommandResponse,
  createVipFloorErrorResponse,
  logVipFloorServerEvent,
  mapVipFloorRpcRejection,
  requireVipFloorV2AdminSession,
  sanitizeVipFloorClientPayload,
} from "./vipFloorV2";
import { recordVipManagerMetric } from "./vipManagerObservability";
import { addTrialRunIdToFingerprint, normalizeTrialVipCommand, TrialSafetyError } from "./trialSafety";

const MAX_COMMAND_BODY_BYTES = 128 * 1024;
const OWNER_SERVICE_OVERRIDE_PREFIX = "Owner explicit override: ";
const OWNER_CAPACITY_OVERRIDE_PREFIX = "Owner capacity override: ";

export type ParsedVipFloorCommand = {
  expectedVersion: number | null;
  fingerprint: JsonValue;
  rpcArgs: Record<string, unknown>;
};

type RunAdminRpcActionV2Options = {
  rpcName: string;
  action: string;
  requiredRole?: "owner";
  requiredCapability?: VipFloorCapability;
  requireCustomerProfileWriteFlag?: boolean;
  parse: (body: unknown) => ParsedVipFloorCommand;
};

export async function runAdminRpcActionV2(
  request: Request,
  options: RunAdminRpcActionV2Options,
) {
  // Admin commands ride a session cookie; a browser-originated mutation must
  // be same-origin (or a configured console origin) with a JSON body. This
  // check runs before the session lookup so cross-site junk never reaches the
  // database.
  const boundary = assertAdminCookieMutation(request);
  if (!boundary.ok) {
    return NextResponse.json(
      { ok: false, error: boundary.error },
      { status: boundary.status },
    );
  }

  const auth = await requireVipFloorV2AdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.actor.role !== "owner") {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: "owner" },
    });
  }

  if (options.requiredRole && auth.actor.role !== options.requiredRole) {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { role: options.requiredRole },
    });
  }

  if (
    !isFeatureEnabled("FEATURE_ADMIN_MUTATION_ENABLED") ||
    !isFeatureEnabled("FEATURE_VIP_FLOOR_V2_MUTATION_ENABLED")
  ) {
    return createVipFloorErrorResponse({ code: "ADMIN_MUTATION_DISABLED" });
  }

  if (
    options.requiredCapability &&
    !actorHasVipFloorCapability(auth.actor.role, options.requiredCapability)
  ) {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: options.requiredCapability },
    });
  }

  if (
    options.requireCustomerProfileWriteFlag &&
    !isFeatureEnabled("FEATURE_VIP_CUSTOMER_PROFILE_WRITE_ENABLED")
  ) {
    return NextResponse.json(
      { ok: false, error: "vip_customer_profile_write_disabled" },
      { status: 403 },
    );
  }

  let idempotencyKey: string;
  let parsed: ParsedVipFloorCommand;

  try {
    idempotencyKey = readStrictIdempotencyKey(request);
    parsed = options.parse(normalizeTrialVipCommand(await readCommandJson(request)));
    if (parsed.expectedVersion !== null) {
      readExpectedVersion(parsed.expectedVersion);
    }
  } catch (error) {
    if (error instanceof CustomerProfileCryptoError) {
      logVipFloorServerEvent("vip_floor_customer_profile_crypto_failed", {
        requestId: auth.actor.requestId,
        adminId: auth.actor.adminId,
        cryptoCode: error.code,
      });
      return NextResponse.json(
        { ok: false, error: { code: "VIP_CUSTOMER_PROFILE_CRYPTO_FAILED" } },
        { status: 500 },
      );
    }

    if (error instanceof TrialSafetyError) {
      return NextResponse.json({ ok: false, error: { code: error.code } }, { status: 403 });
    }

    return createInvalidCommandResponse(
      error instanceof VipFloorContractError ? error.field : undefined,
    );
  }

  const requestHash = adminActionRequestHash(addTrialRunIdToFingerprint({
    action: options.action,
    command: parsed.fingerprint,
  }));
  const rpcStartedAt = performance.now();
  const { data, error } = await createSupabaseAdminClient().rpc(options.rpcName, {
    p_actor_admin_id: auth.actor.adminId,
    p_request_id: auth.actor.requestId,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    ...parsed.rpcArgs,
  });

  if (error) {
    await recordVipManagerMetric({
      metricName: "command_error",
      outcome: "error",
      durationMs: performance.now() - rpcStartedAt,
      actionName: options.action,
      requestId: auth.actor.requestId,
      dimensions: safeRpcMetricDimensions(options.rpcName),
    });
    logVipFloorServerEvent("vip_floor_command_rpc_failed", {
      requestId: auth.actor.requestId,
      adminId: auth.actor.adminId,
      action: options.action,
      rpcName: options.rpcName,
    });
    return NextResponse.json(
      { ok: false, error: { code: "VIP_FLOOR_COMMAND_FAILED" } },
      { status: 500 },
    );
  }

  const rejected = mapVipFloorRpcRejection(data);

  if (rejected) {
    await recordVipManagerMetric({
      metricName: "command",
      outcome: "rejected",
      durationMs: performance.now() - rpcStartedAt,
      actionName: options.action,
      requestId: auth.actor.requestId,
      dimensions: safeRpcMetricDimensions(options.rpcName),
    });
    return rejected;
  }

  const result = normalizeSuccessResult(data, options.action);

  if (!result) {
    await recordVipManagerMetric({
      metricName: "command_error",
      outcome: "error",
      durationMs: performance.now() - rpcStartedAt,
      actionName: options.action,
      requestId: auth.actor.requestId,
      dimensions: safeRpcMetricDimensions(options.rpcName),
    });
    logVipFloorServerEvent("vip_floor_command_rpc_invalid_result", {
      requestId: auth.actor.requestId,
      adminId: auth.actor.adminId,
      action: options.action,
      rpcName: options.rpcName,
    });
    return NextResponse.json(
      { ok: false, error: { code: "VIP_FLOOR_COMMAND_FAILED" } },
      { status: 500 },
    );
  }

  await recordVipManagerMetric({
    metricName: "command",
    outcome: "success",
    durationMs: performance.now() - rpcStartedAt,
    actionName: options.action,
    requestId: auth.actor.requestId,
    dimensions: safeRpcMetricDimensions(options.rpcName, { reused: result.reused }),
  });

  return NextResponse.json(
    sanitizeVipFloorClientPayload({
      ok: true,
      action: result.action,
      reused: result.reused,
      entityVersion: result.entityVersion,
      boardRevision: result.boardRevision,
      auditLogId: result.auditLogId,
      ...result.extras,
    }),
  );
}

function safeRpcMetricDimensions(
  rpcName: string,
  extras: Record<string, string | number | boolean | null> = {},
) {
  return {
    rpcFingerprint: createHash("sha256").update(rpcName).digest("hex").slice(0, 16),
    ...extras,
  };
}

export function parseExpectedVersionBody(value: unknown, allowedKeys: readonly string[]) {
  const body = readStrictObject(value, allowedKeys);
  const expectedVersion = readExpectedVersion(body.expectedVersion);
  return { body, expectedVersion };
}

export function parseScheduleCommand(value: unknown, rawReservationId: string): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "scheduledStartAt",
    "scheduledEndAt",
    "reason",
  ]);
  const command: ScheduleCommand = {
    expectedVersion,
    scheduledStartAt: readIsoTimestamp(body.scheduledStartAt, "scheduledStartAt"),
    scheduledEndAt: readIsoTimestamp(body.scheduledEndAt, "scheduledEndAt"),
    reason: readFixedAdminReason(body.reason),
  };

  if (Date.parse(command.scheduledStartAt) >= Date.parse(command.scheduledEndAt)) {
    throw new VipFloorContractError("Invalid schedule interval", "scheduledEndAt");
  }

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_scheduled_start_at: command.scheduledStartAt,
      p_scheduled_end_at: command.scheduledEndAt,
      p_reason: command.reason,
    },
  };
}

export function parseAssignmentCommand(value: unknown, rawReservationId: string): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "operation",
    "tableIds",
    "reopenOnlineInventory",
    "capacityOverride",
    "reason",
  ]);
  const operation = readStringEnum(
    body.operation,
    ["replace", "add", "remove", "unassign"] as const,
    "operation",
  );
  const tableIds = readUuidArray(body.tableIds, "tableIds", {
    minimum: operation === "unassign" ? 0 : 1,
    maximum: 50,
  });
  const reopenOnlineInventory =
    operation === "unassign"
      ? readBoolean(body.reopenOnlineInventory, "reopenOnlineInventory")
      : undefined;

  if (operation !== "unassign" && body.reopenOnlineInventory !== undefined) {
    throw new VipFloorContractError("Invalid reopenOnlineInventory", "reopenOnlineInventory");
  }

  if (operation === "unassign" && tableIds.length !== 0) {
    throw new VipFloorContractError("Invalid tableIds", "tableIds");
  }

  const capacityOverride = readBoolean(body.capacityOverride, "capacityOverride");
  const reason = readCapacityOverrideReason(body.reason, capacityOverride);

  const command: AssignmentCommand = {
    expectedVersion,
    operation,
    tableIds,
    ...(reopenOnlineInventory === undefined ? {} : { reopenOnlineInventory }),
    capacityOverride,
    reason,
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_operation: command.operation,
      p_table_ids: command.tableIds,
      p_reopen_online_inventory: command.reopenOnlineInventory ?? null,
      p_capacity_override: command.capacityOverride,
      p_reason: command.reason,
    },
  };
}

export function parseServiceStatusCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "toStatus",
    "occurredAt",
    "reason",
  ]);
  const command: ServiceStatusCommand = {
    expectedVersion,
    toStatus: readStringEnum(body.toStatus, VIP_SERVICE_STATUSES, "toStatus"),
    occurredAt: readIsoTimestamp(body.occurredAt, "occurredAt"),
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_to_status: command.toStatus,
      p_occurred_at: command.occurredAt,
      p_reason: command.reason,
    },
  };
}

export function parseServiceStatusOverrideCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "toStatus",
    "occurredAt",
    "confirmedOverride",
    "overrideReason",
  ]);
  if (!readBoolean(body.confirmedOverride, "confirmedOverride")) {
    throw new VipFloorContractError("Override confirmation is required", "confirmedOverride");
  }
  const overrideReason = readBoundedString(body.overrideReason, "overrideReason", {
    maximum: 240,
  });
  if (!overrideReason.trim()) {
    throw new VipFloorContractError("Override reason is required", "overrideReason");
  }
  const command: ServiceStatusCommand = {
    expectedVersion,
    toStatus: readStringEnum(body.toStatus, VIP_SERVICE_STATUSES, "toStatus"),
    occurredAt: readIsoTimestamp(body.occurredAt, "occurredAt"),
    reason: `${OWNER_SERVICE_OVERRIDE_PREFIX}${overrideReason}`,
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, confirmedOverride: true, overrideReason, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_to_status: command.toStatus,
      p_occurred_at: command.occurredAt,
      p_reason: command.reason,
    },
  };
}

export function parseWalkInCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "offeringId",
    "scheduledStartAt",
    "scheduledEndAt",
    "guestCount",
    "tableIds",
    "guestLabel",
    "operatorNote",
    "bookingStaffMemberId",
    "expectedTableVersions",
    "capacityOverride",
    "reason",
  ]);
  const scheduledStartAt = readIsoTimestamp(body.scheduledStartAt, "scheduledStartAt");
  const scheduledEndAt = readIsoTimestamp(body.scheduledEndAt, "scheduledEndAt");

  if (Date.parse(scheduledStartAt) >= Date.parse(scheduledEndAt)) {
    throw new VipFloorContractError("Invalid walk-in interval", "scheduledEndAt");
  }

  const tableIds = readUuidArray(body.tableIds, "tableIds", { minimum: 1, maximum: 50 });
  const expectedTableVersions = readWalkInTableVersions(body.expectedTableVersions, tableIds);
  const capacityOverride = readBoolean(body.capacityOverride, "capacityOverride");
  const reason = readCapacityOverrideReason(body.reason, capacityOverride);

  const command: WalkInCommand = {
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    offeringId: readStrictUuid(body.offeringId, "offeringId"),
    scheduledStartAt,
    scheduledEndAt,
    guestCount: readSafeInteger(body.guestCount, "guestCount", 1, 99),
    tableIds,
    guestLabel: readBoundedString(body.guestLabel, "guestLabel", {
      maximum: 80,
      nullable: true,
    }),
    operatorNote: readBoundedString(body.operatorNote, "operatorNote", {
      maximum: 500,
      nullable: true,
    }),
    bookingStaffMemberId: body.bookingStaffMemberId === null
      || body.bookingStaffMemberId === undefined
      ? null
      : readStrictUuid(body.bookingStaffMemberId, "bookingStaffMemberId"),
    expectedTableVersions,
    capacityOverride,
    reason,
  };

  return {
    expectedVersion: null,
    fingerprint: command,
    rpcArgs: {
      p_event_day_id: command.eventDayId,
      p_booking_offering_id: command.offeringId,
      p_scheduled_start_at: command.scheduledStartAt,
      p_scheduled_end_at: command.scheduledEndAt,
      p_guest_count: command.guestCount,
      p_table_ids: command.tableIds,
      p_guest_label: command.guestLabel,
      p_operator_note: command.operatorNote,
      p_booking_staff_member_id: command.bookingStaffMemberId,
      p_expected_table_versions: command.expectedTableVersions,
      p_capacity_override: command.capacityOverride,
      p_reason: command.reason,
    },
  };
}

export function parseReservationCreateCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "offeringId",
    "scheduledStartAt",
    "scheduledEndAt",
    "guestCount",
    "tableIds",
    "expectedTableVersions",
    "existingCustomerId",
    "displayName",
    "phone",
    "email",
    "languageCode",
    "guestLabel",
    "operatorNote",
    "sourceChannel",
    "serviceStatus",
    "bookingStaffMemberId",
    "notificationPreference",
    "capacityOverride",
    "reason",
  ]);
  const scheduledStartAt = readIsoTimestamp(body.scheduledStartAt, "scheduledStartAt");
  const scheduledEndAt = readIsoTimestamp(body.scheduledEndAt, "scheduledEndAt");
  if (Date.parse(scheduledStartAt) >= Date.parse(scheduledEndAt)) {
    throw new VipFloorContractError("Invalid reservation interval", "scheduledEndAt");
  }
  const tableIds = readUuidArray(body.tableIds, "tableIds", { minimum: 1, maximum: 8 });
  const expectedTableVersions = readWalkInTableVersions(body.expectedTableVersions, tableIds);
  const existingCustomerId = body.existingCustomerId === null
    ? null
    : readStrictUuid(body.existingCustomerId, "existingCustomerId");
  const displayName = readBoundedString(body.displayName, "displayName", {
    maximum: 120,
    nullable: true,
  });
  const phone = readBoundedString(body.phone, "phone", {
    maximum: 40,
    nullable: true,
  });
  const email = readBoundedString(body.email, "email", {
    maximum: 254,
    nullable: true,
  });
  if (email !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
    throw new VipFloorContractError("Invalid email", "email");
  }
  const normalizedPhone = phone === null ? null : normalizeReservationPhone(phone);
  const normalizedEmail = email?.toLowerCase() ?? null;
  const notificationPreference = readStringEnum(
    body.notificationPreference,
    ["none", "email"] as const,
    "notificationPreference",
  );
  if (
    notificationPreference === "email"
    && existingCustomerId === null
    && normalizedEmail === null
  ) {
    throw new VipFloorContractError("Email required for notification", "email");
  }
  const capacityOverride = readBoolean(body.capacityOverride, "capacityOverride");
  const command: ReservationCreateCommand = {
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    offeringId: readStrictUuid(body.offeringId, "offeringId"),
    scheduledStartAt,
    scheduledEndAt,
    guestCount: readSafeInteger(body.guestCount, "guestCount", 1, 99),
    tableIds,
    expectedTableVersions,
    existingCustomerId,
    displayName,
    phone: normalizedPhone,
    email: normalizedEmail,
    languageCode: readBoundedString(body.languageCode, "languageCode", {
      maximum: 16,
      nullable: true,
    }),
    guestLabel: readBoundedString(body.guestLabel, "guestLabel", {
      maximum: 80,
      nullable: true,
    }),
    operatorNote: readBoundedString(body.operatorNote, "operatorNote", {
      maximum: 500,
      nullable: true,
    }),
    sourceChannel: readStringEnum(
      body.sourceChannel,
      ["online", "phone", "admin"] as const,
      "sourceChannel",
    ),
    serviceStatus: readStringEnum(body.serviceStatus, VIP_SERVICE_STATUSES, "serviceStatus"),
    bookingStaffMemberId: body.bookingStaffMemberId === null
      ? null
      : readStrictUuid(body.bookingStaffMemberId, "bookingStaffMemberId"),
    notificationPreference,
    capacityOverride,
    reason: readCapacityOverrideReason(body.reason, capacityOverride),
  };
  const piiFingerprint = createCustomerProfileRequestFingerprint(JSON.stringify({
    displayName,
    phone: normalizedPhone,
    email: normalizedEmail,
  }));

  return {
    expectedVersion: null,
    fingerprint: {
      eventDayId: command.eventDayId,
      offeringId: command.offeringId,
      scheduledStartAt,
      scheduledEndAt,
      guestCount: command.guestCount,
      tableIds,
      expectedTableVersions,
      existingCustomerId,
      piiFingerprint,
      languageCode: command.languageCode,
      guestLabel: command.guestLabel,
      operatorNote: command.operatorNote,
      sourceChannel: command.sourceChannel,
      serviceStatus: command.serviceStatus,
      bookingStaffMemberId: command.bookingStaffMemberId,
      notificationPreference,
      capacityOverride: command.capacityOverride,
      reason: command.reason,
    },
    rpcArgs: {
      p_event_day_id: command.eventDayId,
      p_booking_offering_id: command.offeringId,
      p_scheduled_start_at: scheduledStartAt,
      p_scheduled_end_at: scheduledEndAt,
      p_guest_count: command.guestCount,
      p_table_ids: tableIds,
      p_expected_table_versions: expectedTableVersions,
      p_existing_customer_id: existingCustomerId,
      p_display_name_ciphertext: packCustomerProfileValueForPostgres(displayName),
      p_phone_ciphertext: packCustomerProfileValueForPostgres(normalizedPhone),
      p_email_ciphertext: packCustomerProfileValueForPostgres(normalizedEmail),
      p_phone_search_token:
        normalizedPhone === null ? null : createCustomerProfileSearchToken(normalizedPhone),
      p_email_search_token:
        normalizedEmail === null ? null : createCustomerProfileSearchToken(normalizedEmail),
      p_language_code: command.languageCode,
      p_guest_label: command.guestLabel,
      p_operator_note: command.operatorNote,
      p_source_channel: command.sourceChannel,
      p_service_status: command.serviceStatus,
      p_booking_staff_member_id: command.bookingStaffMemberId,
      p_notification_preference: notificationPreference,
      p_capacity_override: command.capacityOverride,
      p_reason: command.reason,
    },
  };
}

export function parseBusinessDayEnsureCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, ["businessDate", "reason"]);
  const command = {
    businessDate: readBusinessDate(body.businessDate, "businessDate"),
    reason: readBoundedString(body.reason, "reason", { maximum: 240 }),
  };
  return {
    expectedVersion: null,
    fingerprint: command,
    rpcArgs: {
      p_business_date: command.businessDate,
      p_reason: command.reason,
    },
  };
}

export function parseReservationUpdateCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "offeringId",
    "scheduledStartAt",
    "scheduledEndAt",
    "guestCount",
    "tableIds",
    "expectedTableVersions",
    "guestLabel",
    "operatorNote",
    "sourceChannel",
    "serviceStatus",
    "bookingStaffMemberId",
    "notificationPreference",
    "capacityOverride",
    "reason",
  ]);
  const scheduledStartAt = readIsoTimestamp(body.scheduledStartAt, "scheduledStartAt");
  const scheduledEndAt = readIsoTimestamp(body.scheduledEndAt, "scheduledEndAt");
  if (Date.parse(scheduledStartAt) >= Date.parse(scheduledEndAt)) {
    throw new VipFloorContractError("Invalid reservation interval", "scheduledEndAt");
  }
  const tableIds = readUuidArray(body.tableIds, "tableIds", { minimum: 1, maximum: 8 });
  const expectedTableVersions = readWalkInTableVersions(body.expectedTableVersions, tableIds);
  const capacityOverride = readBoolean(body.capacityOverride, "capacityOverride");
  const command: ReservationUpdateCommand = {
    expectedVersion,
    offeringId: readStrictUuid(body.offeringId, "offeringId"),
    scheduledStartAt,
    scheduledEndAt,
    guestCount: readSafeInteger(body.guestCount, "guestCount", 1, 99),
    tableIds,
    expectedTableVersions,
    guestLabel: readBoundedString(body.guestLabel, "guestLabel", {
      maximum: 80,
      nullable: true,
    }),
    operatorNote: readBoundedString(body.operatorNote, "operatorNote", {
      maximum: 500,
      nullable: true,
    }),
    sourceChannel: readStringEnum(
      body.sourceChannel,
      ["online", "phone", "admin"] as const,
      "sourceChannel",
    ),
    serviceStatus: readStringEnum(body.serviceStatus, VIP_SERVICE_STATUSES, "serviceStatus"),
    bookingStaffMemberId: body.bookingStaffMemberId === null
      ? null
      : readStrictUuid(body.bookingStaffMemberId, "bookingStaffMemberId"),
    notificationPreference: readStringEnum(
      body.notificationPreference,
      ["none", "email"] as const,
      "notificationPreference",
    ),
    capacityOverride,
    reason: readCapacityOverrideReason(body.reason, capacityOverride),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: expectedVersion,
      p_booking_offering_id: command.offeringId,
      p_scheduled_start_at: scheduledStartAt,
      p_scheduled_end_at: scheduledEndAt,
      p_guest_count: command.guestCount,
      p_table_ids: tableIds,
      p_expected_table_versions: expectedTableVersions,
      p_guest_label: command.guestLabel,
      p_operator_note: command.operatorNote,
      p_source_channel: command.sourceChannel,
      p_service_status: command.serviceStatus,
      p_booking_staff_member_id: command.bookingStaffMemberId,
      p_notification_preference: command.notificationPreference,
      p_capacity_override: command.capacityOverride,
      p_reason: command.reason,
    },
  };
}

export function parseReservationCustomerRelinkCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "customerId",
    "reason",
  ]);
  const command: ReservationCustomerRelinkCommand = {
    expectedVersion,
    customerId: body.customerId === null
      ? null
      : readStrictUuid(body.customerId, "customerId"),
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: expectedVersion,
      p_customer_id: command.customerId,
      p_reason: command.reason,
    },
  };
}

export function parseCreateWaitlistCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "guestCount",
    "guestLabel",
    "email",
    "reason",
  ]);
  const eventDayId = readStrictUuid(body.eventDayId, "eventDayId");
  const guestCount = readSafeInteger(body.guestCount, "guestCount", 1, 99);
  const guestLabel = readBoundedString(body.guestLabel, "guestLabel", {
    maximum: 80,
    nullable: true,
  });
  const email = readBoundedString(body.email, "email", {
    maximum: 254,
    nullable: true,
  });
  const reason = readFixedAdminReason(body.reason);
  const contactFingerprint = createCustomerProfileRequestFingerprint(
    JSON.stringify({ guestLabel, email: email?.toLowerCase() ?? null }),
  );

  return {
    expectedVersion: null,
    fingerprint: {
      eventDayId,
      guestCount,
      contactFingerprint,
    },
    rpcArgs: {
      p_event_day_id: eventDayId,
      p_guest_count: guestCount,
      p_guest_label_ciphertext: packCustomerProfileValueForPostgres(guestLabel),
      p_email_ciphertext: packCustomerProfileValueForPostgres(email?.toLowerCase() ?? null),
      p_reason: reason,
    },
  };
}

export function parseWaitlistTransitionCommand(
  value: unknown,
  rawWaitlistEntryId: string,
  toStatus: "called" | "expired" | "seated" | "cancelled",
): ParsedVipFloorCommand {
  const waitlistEntryId = readStrictUuid(rawWaitlistEntryId, "waitlistEntryId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "reservationId",
    "reason",
  ]);
  const reservationId = body.reservationId === null
    ? null
    : readStrictUuid(body.reservationId, "reservationId");
  if ((toStatus === "seated") !== (reservationId !== null)) {
    throw new VipFloorContractError("Invalid seated reservation", "reservationId");
  }
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion,
    fingerprint: {
      waitlistEntryId,
      expectedVersion,
      toStatus,
      reservationId,
      reason,
    },
    rpcArgs: {
      p_waitlist_entry_id: waitlistEntryId,
      p_expected_version: expectedVersion,
      p_to_status: toStatus,
      p_seated_reservation_id: reservationId,
      p_reason: reason,
    },
  };
}

export function parseCreateStaffMemberCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, ["displayName", "reason"]);
  const displayName = readBoundedString(body.displayName, "displayName", {
    maximum: 80,
  });
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion: null,
    fingerprint: {
      displayNameFingerprint: createCustomerProfileRequestFingerprint(displayName),
      active: true,
    },
    rpcArgs: {
      p_display_name: displayName,
      p_reason: reason,
    },
  };
}

export function parseUpdateStaffMemberCommand(
  value: unknown,
  rawStaffMemberId: string,
): ParsedVipFloorCommand {
  const staffMemberId = readStrictUuid(rawStaffMemberId, "staffMemberId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "displayName",
    "active",
    "reason",
  ]);
  const displayName = readBoundedString(body.displayName, "displayName", {
    maximum: 80,
  });
  const active = readBoolean(body.active, "active");
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion,
    fingerprint: {
      staffMemberId,
      expectedVersion,
      displayNameFingerprint: createCustomerProfileRequestFingerprint(displayName),
      active,
    },
    rpcArgs: {
      p_staff_member_id: staffMemberId,
      p_expected_version: expectedVersion,
      p_display_name: displayName,
      p_active: active,
      p_reason: reason,
    },
  };
}

export function parseTableStaffAssignmentCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "tableId",
    "staffMemberId",
    "expectedAssignmentVersion",
    "reason",
  ]);
  const expectedAssignmentVersion = body.expectedAssignmentVersion === null
    ? null
    : readExpectedVersion(body.expectedAssignmentVersion, "expectedAssignmentVersion");
  const staffMemberId = body.staffMemberId === null
    ? null
    : readStrictUuid(body.staffMemberId, "staffMemberId");
  const eventDayId = readStrictUuid(body.eventDayId, "eventDayId");
  const tableId = readStrictUuid(body.tableId, "tableId");
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion: expectedAssignmentVersion,
    fingerprint: {
      eventDayId,
      tableId,
      staffMemberId,
      expectedAssignmentVersion,
    },
    rpcArgs: {
      p_event_day_id: eventDayId,
      p_seat_resource_id: tableId,
      p_staff_member_id: staffMemberId,
      p_expected_assignment_version: expectedAssignmentVersion,
      p_reason: reason,
    },
  };
}

export function parseSeatExtensionCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "extendMinutes",
    "reason",
  ]);
  const command: SeatExtensionCommand = {
    expectedVersion,
    extendMinutes: readSafeInteger(body.extendMinutes, "extendMinutes", 15, 120),
    reason: readFixedAdminReason(body.reason),
  };

  if (command.extendMinutes % 15 !== 0) {
    throw new VipFloorContractError("Invalid extension increment", "extendMinutes");
  }

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_extend_minutes: command.extendMinutes,
      p_reason: command.reason,
    },
  };
}

export function parseConfirmationCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "reason",
  ]);
  const command: ConfirmationCommand = {
    expectedVersion,
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_reason: command.reason,
    },
  };
}

export function parseCheckInCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "occurredAt",
    "reason",
  ]);
  const command: CheckInCommand = {
    expectedVersion,
    occurredAt: readIsoTimestamp(body.occurredAt, "occurredAt"),
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_occurred_at: command.occurredAt,
      p_reason: command.reason,
    },
  };
}

export function parseArrivalTimeCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "arrivedAt",
    "reason",
  ]);
  const arrivedAt = readIsoTimestamp(body.arrivedAt, "arrivedAt");
  if (Date.parse(arrivedAt) > Date.now()) {
    throw new VipFloorContractError("Arrival time cannot be in the future", "arrivedAt");
  }
  const command: ArrivalTimeCommand = {
    expectedVersion,
    arrivedAt,
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_arrived_at: command.arrivedAt,
      p_reason: command.reason,
    },
  };
}

export function parseEmailNotificationCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "template",
    "reason",
  ]);
  const command: EmailNotificationCommand = {
    expectedVersion,
    template: readStringEnum(
      body.template,
      [
        "reservation_created",
        "reservation_changed",
        "waitlist_called",
        "waitlist_recalled",
      ] as const,
      "template",
    ),
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_template: command.template,
      p_reason: command.reason,
    },
  };
}

export function parseCancellationCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "reasonCode",
    "reasonNote",
    "refundDecision",
    "refundAmountYen",
    "notifyCustomer",
  ]);
  const reasonCode = readStringEnum(
    body.reasonCode,
    ["customer_request", "duplicate", "venue_decision", "no_contact", "other"] as const,
    "reasonCode",
  );
  const reasonNote = readBoundedString(body.reasonNote, "reasonNote", {
    maximum: 500,
    nullable: true,
  });
  const refundDecision = readStringEnum(
    body.refundDecision,
    ["none", "full", "partial", "review"] as const,
    "refundDecision",
  );

  if (reasonCode === "other" && !reasonNote) {
    throw new VipFloorContractError("Cancellation reason note required", "reasonNote");
  }

  let refundAmountYen: number | null;

  if (refundDecision === "none") {
    refundAmountYen =
      body.refundAmountYen === null
        ? null
        : readSafeInteger(body.refundAmountYen, "refundAmountYen", 0, 0);
  } else if (refundDecision === "partial") {
    refundAmountYen = readSafeInteger(
      body.refundAmountYen,
      "refundAmountYen",
      1,
      2_147_483_647,
    );
  } else {
    if (body.refundAmountYen !== null) {
      throw new VipFloorContractError("Invalid refundAmountYen", "refundAmountYen");
    }
    refundAmountYen = null;
  }

  const command: CancellationCommand = {
    expectedVersion,
    reasonCode,
    reasonNote,
    refundDecision,
    refundAmountYen,
    notifyCustomer: readBoolean(body.notifyCustomer, "notifyCustomer"),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_version: command.expectedVersion,
      p_reason_code: command.reasonCode,
      p_reason_note: command.reasonNote,
      p_refund_decision: command.refundDecision,
      p_refund_amount_yen: command.refundAmountYen,
      p_notify_customer: command.notifyCustomer,
    },
  };
}

export function parseReservationNoteCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "noteId",
    "expectedNoteVersion",
    "kind",
    "body",
    "pinned",
    "reason",
  ]);
  const noteId = body.noteId === null ? null : readStrictUuid(body.noteId, "noteId");
  const expectedNoteVersion =
    body.expectedNoteVersion === null
      ? null
      : readExpectedVersion(body.expectedNoteVersion, "expectedNoteVersion");

  if ((noteId === null) !== (expectedNoteVersion === null)) {
    throw new VipFloorContractError("Invalid note version", "expectedNoteVersion");
  }

  const command: ReservationNoteCommand = {
    expectedVersion,
    noteId,
    expectedNoteVersion,
    kind: readStringEnum(body.kind, ["floor", "booking", "private"] as const, "kind"),
    body: readBoundedString(body.body, "body", { maximum: 2000 }),
    pinned: readBoolean(body.pinned, "pinned"),
    reason: readFixedAdminReason(body.reason),
  };

  return {
    expectedVersion,
    fingerprint: { reservationId, ...command },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_reservation_version: command.expectedVersion,
      p_note_id: command.noteId,
      p_expected_note_version: command.expectedNoteVersion,
      p_kind: command.kind,
      p_body: command.body,
      p_pinned: command.pinned,
      p_reason: command.reason,
    },
  };
}

export function parseArchiveReservationNoteCommand(
  value: unknown,
  rawReservationId: string,
): ParsedVipFloorCommand {
  const reservationId = readStrictUuid(rawReservationId, "reservationId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "noteId",
    "expectedNoteVersion",
    "reason",
  ]);
  const noteId = readStrictUuid(body.noteId, "noteId");
  const expectedNoteVersion = readExpectedVersion(body.expectedNoteVersion, "expectedNoteVersion");
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion,
    fingerprint: { reservationId, expectedVersion, noteId, expectedNoteVersion, reason },
    rpcArgs: {
      p_reservation_id: reservationId,
      p_expected_reservation_version: expectedVersion,
      p_note_id: noteId,
      p_expected_note_version: expectedNoteVersion,
      p_reason: reason,
    },
  };
}

export function parseCustomerProfileCommand(
  value: unknown,
  rawCustomerId: string,
): ParsedVipFloorCommand {
  const customerId = readStrictUuid(rawCustomerId, "customerId");
  const body = readStrictObject(value, [
    "expectedVersion",
    "eventDayId",
    "reservationId",
    "displayName",
    "nameKana",
    "phone",
    "email",
    "languageCode",
    "allergies",
    "preferences",
    "reason",
  ]);
  const expectedVersion =
    body.expectedVersion === null ? null : readExpectedVersion(body.expectedVersion);
  const command: CustomerProfileCommand = {
    expectedVersion,
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    reservationId:
      body.reservationId === null ? null : readStrictUuid(body.reservationId, "reservationId"),
    displayName: readBoundedString(body.displayName, "displayName", {
      maximum: 120,
      nullable: true,
    }),
    nameKana: readBoundedString(body.nameKana, "nameKana", { maximum: 120, nullable: true }),
    phone: readBoundedString(body.phone, "phone", { maximum: 32, nullable: true }),
    email: readBoundedString(body.email, "email", { maximum: 254, nullable: true }),
    languageCode:
      body.languageCode === null
        ? null
        : readStringEnum(body.languageCode, ["ja", "en", "ko", "zh"] as const, "languageCode"),
    allergies: readBoundedString(body.allergies, "allergies", {
      maximum: 2000,
      nullable: true,
    }),
    preferences: readBoundedString(body.preferences, "preferences", {
      maximum: 4000,
      nullable: true,
    }),
    reason: readFixedAdminReason(body.reason),
  };
  const profileFingerprint = createCustomerProfileRequestFingerprint(
    JSON.stringify({ customerId, ...command }),
  );

  return {
    expectedVersion,
    fingerprint: {
      customerId,
      eventDayId: command.eventDayId,
      reservationId: command.reservationId,
      expectedVersion: command.expectedVersion,
      profileFingerprint,
    },
    rpcArgs: {
      p_event_day_id: command.eventDayId,
      p_reservation_id: command.reservationId,
      p_customer_id: customerId,
      p_expected_profile_version: command.expectedVersion,
      p_display_name_ciphertext: packCustomerProfileValueForPostgres(command.displayName),
      p_name_kana_ciphertext: packCustomerProfileValueForPostgres(command.nameKana),
      p_phone_ciphertext: packCustomerProfileValueForPostgres(command.phone),
      p_email_ciphertext: packCustomerProfileValueForPostgres(command.email),
      p_display_name_search_token:
        command.displayName === null ? null : createCustomerProfileSearchToken(command.displayName),
      p_language_code: command.languageCode,
      p_allergies_ciphertext: packCustomerProfileValueForPostgres(command.allergies),
      p_preferences_ciphertext: packCustomerProfileValueForPostgres(command.preferences),
      p_reason: command.reason,
    },
  };
}

export function parseCustomerAttributesCommand(
  value: unknown,
  rawCustomerId: string,
): ParsedVipFloorCommand {
  const customerId = readStrictUuid(rawCustomerId, "customerId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "eventDayId",
    "reservationId",
    "nationalityCode",
    "birthDate",
    "anniversaryDate",
    "vipRank",
    "reason",
  ]);
  const readNullableDate = (input: unknown, field: string) => input === null
    ? null
    : readBusinessDate(input, field);
  const command: CustomerAttributesCommand = {
    expectedVersion,
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    reservationId: readStrictUuid(body.reservationId, "reservationId"),
    nationalityCode: readBoundedString(body.nationalityCode, "nationalityCode", {
      maximum: 2,
      nullable: true,
    })?.toUpperCase() ?? null,
    birthDate: readNullableDate(body.birthDate, "birthDate"),
    anniversaryDate: readNullableDate(body.anniversaryDate, "anniversaryDate"),
    vipRank: readBoundedString(body.vipRank, "vipRank", {
      maximum: 32,
      nullable: true,
    }),
    reason: readFixedAdminReason(body.reason),
  };
  if (
    command.nationalityCode !== null
    && !/^[A-Z]{2}$/u.test(command.nationalityCode)
  ) {
    throw new VipFloorContractError("Invalid nationalityCode", "nationalityCode");
  }
  const attributeFingerprint = createCustomerProfileRequestFingerprint(JSON.stringify({
    nationalityCode: command.nationalityCode,
    birthDate: command.birthDate,
    anniversaryDate: command.anniversaryDate,
    vipRank: command.vipRank,
  }));

  return {
    expectedVersion,
    fingerprint: {
      customerId,
      expectedVersion,
      eventDayId: command.eventDayId,
      reservationId: command.reservationId,
      attributeFingerprint,
    },
    rpcArgs: {
      p_event_day_id: command.eventDayId,
      p_reservation_id: command.reservationId,
      p_customer_id: customerId,
      p_expected_profile_version: expectedVersion,
      p_nationality_code: command.nationalityCode,
      p_birth_date: command.birthDate,
      p_anniversary_date: command.anniversaryDate,
      p_vip_rank: command.vipRank,
      p_reason: command.reason,
    },
  };
}

function readWalkInTableVersions(value: unknown, tableIds: string[]) {
  if (!Array.isArray(value) || value.length !== tableIds.length) {
    throw new VipFloorContractError("Invalid expectedTableVersions", "expectedTableVersions");
  }

  const versions: WalkInTableVersion[] = value.map((item) => {
    const entry = readStrictObject(item, ["tableId", "expectedVersion"], "expectedTableVersions");
    return {
      tableId: readStrictUuid(entry.tableId, "tableId"),
      expectedVersion: readExpectedVersion(entry.expectedVersion, "expectedTableVersions"),
    };
  });
  const sorted = versions.sort((left, right) => left.tableId.localeCompare(right.tableId));

  if (
    new Set(sorted.map((entry) => entry.tableId)).size !== sorted.length ||
    sorted.some((entry, index) => entry.tableId !== tableIds[index])
  ) {
    throw new VipFloorContractError("Invalid expectedTableVersions", "expectedTableVersions");
  }

  return sorted;
}

export function parseCreateVipBlockCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "scope",
    "kind",
    "startAt",
    "endAt",
    "memo",
    "seatResourceIds",
    "floorSectionIds",
    "venueWide",
    "reason",
  ]);
  const command: VipBlockCreateCommand = {
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    ...parseVipBlockFields(body),
  };

  return {
    expectedVersion: null,
    fingerprint: command,
    rpcArgs: {
      p_event_day_id: command.eventDayId,
      ...vipBlockRpcArgs(command),
    },
  };
}

export function parseCreateVipBlockSeriesCommand(value: unknown): ParsedVipFloorCommand {
  const body = readStrictObject(value, [
    "eventDayId",
    "repeatDays",
    "scope",
    "kind",
    "startAt",
    "endAt",
    "memo",
    "seatResourceIds",
    "floorSectionIds",
    "venueWide",
    "reason",
  ]);
  const command: VipBlockCreateCommand & { repeatDays: number } = {
    eventDayId: readStrictUuid(body.eventDayId, "eventDayId"),
    repeatDays: readSafeInteger(body.repeatDays, "repeatDays", 1, 14),
    ...parseVipBlockFields(body),
  };

  return {
    expectedVersion: null,
    fingerprint: command,
    rpcArgs: {
      p_first_event_day_id: command.eventDayId,
      p_repeat_days: command.repeatDays,
      ...vipBlockRpcArgs(command),
    },
  };
}

export function parseUpdateVipBlockCommand(
  value: unknown,
  rawBlockId: string,
): ParsedVipFloorCommand {
  const blockId = readStrictUuid(rawBlockId, "blockId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, [
    "expectedVersion",
    "scope",
    "kind",
    "startAt",
    "endAt",
    "memo",
    "seatResourceIds",
    "floorSectionIds",
    "venueWide",
    "reason",
  ]);
  const command: VipBlockUpdateCommand = {
    expectedVersion,
    ...parseVipBlockFields(body),
  };

  return {
    expectedVersion,
    fingerprint: { blockId, ...command },
    rpcArgs: {
      p_block_id: blockId,
      p_expected_version: command.expectedVersion,
      ...vipBlockRpcArgs(command),
    },
  };
}

export function parseCancelVipBlockCommand(
  value: unknown,
  rawBlockId: string,
): ParsedVipFloorCommand {
  const blockId = readStrictUuid(rawBlockId, "blockId");
  const { body, expectedVersion } = parseExpectedVersionBody(value, ["expectedVersion", "reason"]);
  const reason = readFixedAdminReason(body.reason);

  return {
    expectedVersion,
    fingerprint: { blockId, expectedVersion, reason },
    rpcArgs: {
      p_block_id: blockId,
      p_expected_version: expectedVersion,
      p_reason: reason,
    },
  };
}

function parseVipBlockFields(body: Record<string, unknown>): VipBlockFields {
  const startAt = readIsoTimestamp(body.startAt, "startAt");
  const endAt = readIsoTimestamp(body.endAt, "endAt");

  if (Date.parse(startAt) >= Date.parse(endAt)) {
    throw new VipFloorContractError("Invalid block interval", "endAt");
  }

  const seatResourceIds = readUuidArray(body.seatResourceIds, "seatResourceIds", {
    maximum: 100,
  });
  const floorSectionIds = readUuidArray(body.floorSectionIds, "floorSectionIds", {
    maximum: 25,
  });
  const venueWide = readBoolean(body.venueWide, "venueWide");

  if (
    (venueWide && (seatResourceIds.length > 0 || floorSectionIds.length > 0)) ||
    (!venueWide && seatResourceIds.length === 0 && floorSectionIds.length === 0)
  ) {
    throw new VipFloorContractError("Invalid block targets", "targets");
  }

  return {
    scope: readStringEnum(body.scope, ["online_only", "all_operations"] as const, "scope"),
    kind: readStringEnum(
      body.kind,
      ["manual", "maintenance", "owner_hold", "event", "unassignment_guard"] as const,
      "kind",
    ),
    startAt,
    endAt,
    memo: readBoundedString(body.memo, "memo", { maximum: 1000, nullable: true }),
    seatResourceIds,
    floorSectionIds,
    venueWide,
    reason: readFixedAdminReason(body.reason),
  };
}

function vipBlockRpcArgs(command: VipBlockFields) {
  return {
    p_scope: command.scope,
    p_kind: command.kind,
    p_start_at: command.startAt,
    p_end_at: command.endAt,
    p_memo: command.memo,
    p_seat_resource_ids: command.seatResourceIds,
    p_floor_section_ids: command.floorSectionIds,
    p_venue_wide: command.venueWide,
    p_reason: command.reason,
  };
}

function readFixedAdminReason(value: unknown) {
  if (value !== undefined && value !== VIP_MANAGER_FIXED_AUDIT_REASON) {
    throw new VipFloorContractError("Invalid reason", "reason");
  }

  return VIP_MANAGER_FIXED_AUDIT_REASON;
}

function readCapacityOverrideReason(value: unknown, capacityOverride: boolean) {
  if (!capacityOverride) {
    return readFixedAdminReason(value);
  }
  const reason = readBoundedString(value, "reason", {
    maximum: OWNER_CAPACITY_OVERRIDE_PREFIX.length + 240,
  });
  const detail = reason.startsWith(OWNER_CAPACITY_OVERRIDE_PREFIX)
    ? reason.slice(OWNER_CAPACITY_OVERRIDE_PREFIX.length).trim()
    : "";
  if (!detail || detail.length > 240) {
    throw new VipFloorContractError("Capacity override requires explicit Owner reason", "reason");
  }
  return `${OWNER_CAPACITY_OVERRIDE_PREFIX}${detail}`;
}

function readStrictIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key");

  if (!isValidVipManagerIdempotencyKey(value)) {
    throw new VipFloorContractError("Invalid Idempotency-Key", "Idempotency-Key");
  }

  return value;
}

async function readCommandJson(request: Request) {
  // Streaming byte ceiling: both a declared Content-Length over the cap and a
  // chunked body that grows past it are rejected without buffering the body.
  let body: string;
  try {
    body = await readBoundedText(request, MAX_COMMAND_BODY_BYTES);
  } catch (error) {
    if (isHttpBodyError(error)) {
      const tooLarge =
        error.code === "body_too_large" || error.code === "declared_length_too_large";
      throw new VipFloorContractError(
        tooLarge ? "Command body too large" : "Invalid JSON body",
        "body",
      );
    }
    throw error;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new VipFloorContractError("Invalid JSON body", "body");
  }
}

function normalizeSuccessResult(data: unknown, fallbackAction: string) {
  if (!isRecord(data)) {
    return null;
  }

  const response = isRecord(data.response) ? data.response : {};
  const merged: VipFloorRpcResult = { ...data, ...response };
  const entityVersion = readResultInteger(merged.entityVersion ?? response.entity_version, 1);
  const boardRevision = readResultInteger(merged.boardRevision ?? response.board_revision, 0);
  const auditLogId = readResultUuid(merged.auditLogId ?? response.audit_log_id);
  const action = typeof merged.action === "string" ? merged.action : fallbackAction;

  if (
    merged.ok !== true ||
    action !== fallbackAction ||
    entityVersion === null ||
    boardRevision === null ||
    !auditLogId
  ) {
    return null;
  }

  return {
    action,
    reused: merged.reused === true || data.action === "reused",
    entityVersion,
    boardRevision,
    auditLogId,
    extras: readSafeSuccessExtras(merged),
  };
}

function readSafeSuccessExtras(result: VipFloorRpcResult) {
  const extraKeys = [
    "reservationId",
    "blockId",
    "noteId",
    "customerId",
    "waitlistEntryId",
    "staffMemberId",
    "assignmentId",
    "cancellationId",
    "operation",
    "reservationVersion",
    "tableIds",
    "warnings",
    "refundDecision",
    "refundAmountYen",
    "refundCaseCreated",
    "remainingRefundableYen",
    "releasedAssignmentCount",
    "notifyCustomer",
    "noOp",
    "publicCode",
    "scheduledStartAt",
    "scheduledEndAt",
    "expectedReleaseAt",
    "extendMinutes",
    "previousDueAt",
    "newDueAt",
    "notificationPreference",
    "createdCount",
    "results",
    "eventDayId",
    "businessDate",
    "created",
    "slotsCreated",
    "operatingStatus",
  ] as const;
  const extras: Record<string, unknown> = {};

  for (const key of extraKeys) {
    if (result[key] !== undefined) {
      extras[key] = result[key];
    }
  }

  return extras;
}

function normalizeReservationPhone(value: string) {
  const normalized = value.normalize("NFKC").replace(/[^\d+]/gu, "");
  if (!/^\+?[0-9]{7,20}$/u.test(normalized)) {
    throw new VipFloorContractError("Invalid phone", "phone");
  }
  return normalized;
}

function readResultInteger(value: unknown, minimum: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;
}

function readResultUuid(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
    ? value
    : null;
}
