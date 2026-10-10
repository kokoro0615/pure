import { createHash, createHmac, randomUUID } from "node:crypto";

export type VipFloorShadowClass =
  | "equal"
  | "expected_v2_rule"
  | "snapshot_race"
  | "critical_missing"
  | "critical_value"
  | "critical_error"
  | "privacy_violation";

export type VipFloorShadowResult = {
  classification: VipFloorShadowClass;
  ruleId?: string;
};

export type VipFloorShadowRouteKind =
  | "admin-board"
  | "availability"
  | "seat-availability";

export type VipFloorShadowCompletionOutcome = "completed" | "failed";

const EXPECTED_RULE_IDS = new Set([
  "V2_BLOCK",
  "V2_ONLINE_INELIGIBLE",
  "V2_OPERATIONAL_LOCK",
  "V2_INTERVAL_OVERLAP",
  "STATUS_DECOMPOSITION",
]);

const FORBIDDEN_CANONICAL_KEYS = /^(?:id|customerId|displayLabel|guestLabel|name|email|phone|operatorNote|noteBody|memo|ciphertext|providerObjectId|stripePaymentMethodId|stripeChargeId|lineUserId|requestBody|beforeJson|afterJson)$/i;

type CanonicalReservation = {
  publicCode: string;
  lifecycleStatus: string;
  serviceStatus: string | null;
  guestCount: number;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  expectedReleaseAt: string | null;
};

type CanonicalAssignment = {
  publicCode: string;
  publicResourceCode: string;
  startAt: string | null;
  endAt: string | null;
  assignmentRole: "primary" | "additional";
};

type CanonicalPayment = {
  publicCode: string;
  status: string | null;
  type: string | null;
  amountYen: number;
  paymentMethodSaved: boolean;
  webhookStatusCategory: string | null;
  providerStatusCategory: string | null;
};

export function canonicalizeAdminV1(value: unknown) {
  const payload = readRecord(value);
  const reservations: CanonicalReservation[] = [];
  const assignments: CanonicalAssignment[] = [];
  const payments: CanonicalPayment[] = [];

  for (const rawReservation of readArray(payload.reservations)) {
    const reservation = readRecord(rawReservation);
    const publicCode = readString(reservation.publicCode);
    const slot = readRecord(reservation.slot);
    const normalizedStatus = normalizeLifecycle(
      readString(reservation.status),
      null,
    );

    if (!publicCode) continue;

    const canonicalReservation: CanonicalReservation = {
      publicCode,
      lifecycleStatus: normalizedStatus.lifecycleStatus,
      serviceStatus: normalizedStatus.serviceStatus,
      guestCount: readNumber(reservation.guestCount),
      scheduledStartAt: normalizeTimestamp(slot.startAt),
      scheduledEndAt: normalizeTimestamp(slot.endAt),
      expectedReleaseAt: normalizeTimestamp(
        reservation.seatExtendedUntilAt ?? reservation.seatDueAt ?? slot.endAt,
      ),
    };
    reservations.push(canonicalReservation);

    const activeSeats = readArray(reservation.seats)
      .map(readRecord)
      .filter((seat) =>
        ["held", "payment_grace_locked", "confirmed"].includes(readString(seat.lockStatus)),
      );
    activeSeats.forEach((seat, index) => {
      const publicResourceCode = readString(seat.publicResourceCode);
      if (!publicResourceCode) return;
      assignments.push({
        publicCode,
        publicResourceCode,
        startAt: canonicalReservation.scheduledStartAt,
        endAt: canonicalReservation.expectedReleaseAt,
        assignmentRole: index === 0 ? "primary" : "additional",
      });
    });

    const payment = readRecord(reservation.payment);
    if (Object.keys(payment).length > 0) {
      payments.push(canonicalizePayment(publicCode, payment));
    }
  }

  return buildCanonicalAdmin(
    readString(payload.businessDate),
    readRecord(payload.eventDay),
    reservations,
    assignments,
    payments,
  );
}

export function canonicalizeAdminV2(value: unknown) {
  const payload = readRecord(value);
  const reservationCodeById = new Map<string, string>();
  const tableCodeById = new Map<string, string>();
  const reservations: CanonicalReservation[] = [];
  const assignments: CanonicalAssignment[] = [];
  const payments: CanonicalPayment[] = [];

  for (const rawTable of readArray(payload.tables)) {
    const table = readRecord(rawTable);
    const internalId = readString(table.id);
    const publicResourceCode = readString(table.publicResourceCode);
    if (internalId && publicResourceCode) tableCodeById.set(internalId, publicResourceCode);
  }

  for (const rawReservation of readArray(payload.reservations)) {
    const reservation = readRecord(rawReservation);
    const internalId = readString(reservation.id);
    const publicCode = readString(reservation.publicCode);
    const guestCount = readRecord(reservation.guestCount);
    const normalizedStatus = normalizeLifecycle(
      readString(reservation.lifecycleStatus),
      readNullableString(reservation.serviceStatus),
    );
    if (!publicCode) continue;
    if (internalId) reservationCodeById.set(internalId, publicCode);

    reservations.push({
      publicCode,
      lifecycleStatus: normalizedStatus.lifecycleStatus,
      serviceStatus: normalizedStatus.serviceStatus,
      guestCount: readNumber(guestCount.total),
      scheduledStartAt: normalizeTimestamp(reservation.scheduledStartAt),
      scheduledEndAt: normalizeTimestamp(reservation.scheduledEndAt),
      expectedReleaseAt: normalizeTimestamp(reservation.expectedReleaseAt),
    });

    const payment = readRecord(reservation.payment);
    if (Object.keys(payment).length > 0) {
      payments.push(canonicalizePayment(publicCode, payment));
    }
  }

  for (const rawAssignment of readArray(payload.assignments)) {
    const assignment = readRecord(rawAssignment);
    const publicCode = reservationCodeById.get(readString(assignment.reservationId));
    const publicResourceCode = tableCodeById.get(readString(assignment.tableId));
    if (!publicCode || !publicResourceCode) continue;
    assignments.push({
      publicCode,
      publicResourceCode,
      startAt: normalizeTimestamp(assignment.startAt),
      endAt: normalizeTimestamp(assignment.endAt),
      assignmentRole:
        readString(assignment.assignmentRole) === "additional" ? "additional" : "primary",
    });
  }

  const businessDay = readRecord(payload.businessDay);
  return buildCanonicalAdmin(
    readString(businessDay.businessDate),
    businessDay,
    reservations,
    assignments,
    payments,
  );
}

export function canonicalizePublicAvailability(value: unknown) {
  return readArray(value)
    .map((rawRow) => {
      const row = readRecord(rawRow);
      return {
        slot: readString(row.public_slot_id ?? row.publicSlotId),
        publicOfferingId: readString(row.public_offering_id ?? row.publicOfferingId),
        startAt: normalizeTimestamp(row.start_at ?? row.startAt),
        endAt: normalizeTimestamp(row.end_at ?? row.endAt),
        capacity: {
          min: readNumber(row.min_guests ?? row.minGuests),
          max: readNumber(row.max_guests ?? row.maxGuests),
        },
        availableCount: readNumber(
          row.available_resource_count ?? row.availableResourceCount,
        ),
        isAvailable: readBoolean(row.is_available ?? row.isAvailable),
        safePublicPrice: readNumber(row.min_spend_yen ?? row.minSpendYen),
      };
    })
    .filter((row) => row.slot && row.publicOfferingId)
    .sort((left, right) => compareText(
      `${left.slot}\0${left.publicOfferingId}`,
      `${right.slot}\0${right.publicOfferingId}`,
    ));
}

export function canonicalizePublicSeatAvailability(value: unknown) {
  return readArray(value)
    .map((rawRow) => {
      const row = readRecord(rawRow);
      return {
        slot: readString(row.public_slot_id ?? row.publicSlotId),
        publicResourceCode: readString(
          row.public_resource_code ?? row.publicResourceCode,
        ),
        startAt: normalizeTimestamp(row.start_at ?? row.startAt),
        endAt: normalizeTimestamp(row.end_at ?? row.endAt),
        capacity: {
          min: readNumber(row.capacity_min ?? row.capacityMin),
          max: readNumber(row.capacity_max ?? row.capacityMax),
        },
        isAvailable: readBoolean(row.is_available ?? row.isAvailable),
      };
    })
    .filter((row) => row.slot && row.publicResourceCode)
    .sort((left, right) => compareText(
      `${left.slot}\0${left.publicResourceCode}`,
      `${right.slot}\0${right.publicResourceCode}`,
    ));
}

export function compareVipFloorCanonical(
  left: unknown,
  right: unknown,
  options: { expectedRuleId?: string; snapshotRace?: boolean } = {},
): VipFloorShadowResult {
  if (hasForbiddenCanonicalKey(left) || hasForbiddenCanonicalKey(right)) {
    return { classification: "privacy_violation" };
  }

  if (stableStringify(left) === stableStringify(right)) {
    return { classification: "equal" };
  }

  if (options.snapshotRace) {
    return { classification: "snapshot_race" };
  }

  if (options.expectedRuleId && EXPECTED_RULE_IDS.has(options.expectedRuleId)) {
    return {
      classification: "expected_v2_rule",
      ruleId: options.expectedRuleId,
    };
  }

  return {
    classification: hasDifferentBusinessKeys(left, right)
      ? "critical_missing"
      : "critical_value",
  };
}

export function vipFloorShadowDigest(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildVipFloorShadowEvidence({
  businessDate,
  completionOrdinal,
  completionOutcome,
  comparisonKey,
  durationMs,
  mode,
  requestCorrelationId,
  routeKind,
  results,
  scheduleAttempt,
  servedContract,
}: {
  businessDate: string | null;
  completionOrdinal: number;
  completionOutcome: VipFloorShadowCompletionOutcome;
  comparisonKey: string;
  durationMs: number;
  mode: "deterministic" | "runtime-sample";
  requestCorrelationId: string;
  routeKind: VipFloorShadowRouteKind;
  results: VipFloorShadowResult[];
  scheduleAttempt: number;
  servedContract: "v1" | "v2" | "none";
}) {
  const counts = {
    equal: 0,
    expectedV2Rule: 0,
    snapshotRace: 0,
    criticalMissing: 0,
    criticalValue: 0,
    criticalError: 0,
    privacyViolation: 0,
  };
  const ruleCounts: Record<string, number> = {};

  for (const result of results) {
    const countKey = {
      equal: "equal",
      expected_v2_rule: "expectedV2Rule",
      snapshot_race: "snapshotRace",
      critical_missing: "criticalMissing",
      critical_value: "criticalValue",
      critical_error: "criticalError",
      privacy_violation: "privacyViolation",
    }[result.classification] as keyof typeof counts;
    counts[countKey] += 1;
    if (result.ruleId) ruleCounts[result.ruleId] = (ruleCounts[result.ruleId] ?? 0) + 1;
  }

  return {
    schemaVersion: 2,
    runId: randomUUID(),
    mode,
    servedContract,
    correlationSha256: createHash("sha256").update(requestCorrelationId).digest("hex"),
    routeKind,
    requestKind: routeKind,
    scheduleAttempt,
    attemptOrdinal: scheduleAttempt,
    completionOrdinal,
    completionOutcome,
    businessDateHash: createHmac("sha256", comparisonKey)
      .update(businessDate ?? "all-business-dates")
      .digest("hex")
      .slice(0, 16),
    counts,
    ruleCounts,
    durationMs: Math.max(0, Math.round(durationMs)),
    buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    sourceSha256: readLineageSha(process.env.VIP_FLOOR_RUNTIME_SOURCE_SHA256),
    deploymentSha256: digestDeploymentHost(process.env.VERCEL_URL),
    migrationHead: "20260714121000_ghost_vip_floor_p0_public_dual_write_v8",
  };
}

export function criticalShadowError(): VipFloorShadowResult {
  return { classification: "critical_error" };
}

export function hasForbiddenCanonicalKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenCanonicalKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_CANONICAL_KEYS.test(key) || hasForbiddenCanonicalKey(child),
  );
}

function buildCanonicalAdmin(
  businessDate: string,
  eventDay: Record<string, unknown>,
  reservations: CanonicalReservation[],
  assignments: CanonicalAssignment[],
  payments: CanonicalPayment[],
) {
  reservations.sort((left, right) => compareText(left.publicCode, right.publicCode));
  assignments.sort((left, right) => compareText(
    `${left.publicCode}\0${left.publicResourceCode}\0${left.startAt}`,
    `${right.publicCode}\0${right.publicResourceCode}\0${right.startAt}`,
  ));
  payments.sort((left, right) => compareText(left.publicCode, right.publicCode));

  const assignedCodes = new Set(assignments.map((assignment) => assignment.publicCode));
  const reservationsByStatus = Object.fromEntries(
    [...reservations.reduce((counts, reservation) => {
      const key = `${reservation.lifecycleStatus}:${reservation.serviceStatus ?? "not_set"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort(([left], [right]) => compareText(left, right)),
  );
  const totals = {
    reservationsByStatus,
    assignedCount: assignments.length,
    unassignedCount: reservations.filter(({ publicCode }) => !assignedCodes.has(publicCode)).length,
    seatsInUse: new Set(assignments.map(({ publicResourceCode }) => publicResourceCode)).size,
    conflictCount: countAssignmentConflicts(assignments),
  };

  return {
    eventDay: {
      businessDate,
      openState: {
        operatingStartAt: normalizeTimestamp(
          eventDay.salesOpenAt ?? eventDay.operatingStartAt,
        ),
        operatingEndAt: normalizeTimestamp(
          eventDay.salesCloseAt ?? eventDay.operatingEndAt,
        ),
      },
      totals: {
        reservationCount: reservations.length,
        guestCount: reservations.reduce((sum, reservation) => sum + reservation.guestCount, 0),
      },
    },
    reservations,
    assignments,
    payments,
    totals,
  };
}

function canonicalizePayment(publicCode: string, payment: Record<string, unknown>) {
  return {
    publicCode,
    status: readNullableString(payment.status),
    type: readNullableString(payment.type),
    amountYen: readNumber(payment.amountYen),
    paymentMethodSaved: readBoolean(payment.paymentMethodSaved),
    webhookStatusCategory: normalizeCategory(
      payment.webhookProcessingStatus,
      ["received", "processing", "processed", "ignored", "retry", "dead"],
    ),
    providerStatusCategory: normalizeCategory(
      payment.stripeObjectStatus,
      [
        "requires_payment_method", "requires_confirmation", "requires_action",
        "processing", "succeeded", "canceled", "complete", "open",
      ],
    ),
  };
}

function normalizeLifecycle(lifecycle: string, serviceStatus: string | null) {
  if (lifecycle === "checked_in") {
    return { lifecycleStatus: "confirmed", serviceStatus: "seated" };
  }
  if (["hold_expired", "payment_window_expired", "expired"].includes(lifecycle)) {
    return { lifecycleStatus: "expired", serviceStatus };
  }
  return {
    lifecycleStatus: lifecycle,
    serviceStatus: lifecycle === "confirmed" && serviceStatus === null ? "expected" : serviceStatus,
  };
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function normalizeCategory(value: unknown, known: string[]) {
  const normalized = readString(value).toLowerCase();
  if (!normalized) return null;
  return known.includes(normalized) ? normalized : "other";
}

function countAssignmentConflicts(assignments: CanonicalAssignment[]) {
  let conflicts = 0;
  for (let leftIndex = 0; leftIndex < assignments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < assignments.length; rightIndex += 1) {
      const left = assignments[leftIndex];
      const right = assignments[rightIndex];
      if (
        left.publicResourceCode === right.publicResourceCode &&
        left.startAt && left.endAt && right.startAt && right.endAt &&
        left.startAt < right.endAt && right.startAt < left.endAt
      ) conflicts += 1;
    }
  }
  return conflicts;
}

function hasDifferentBusinessKeys(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const keyOf = (value: unknown) => {
    const row = readRecord(value);
    return readString(
      row.publicCode ?? row.publicResourceCode ?? row.publicOfferingId ?? row.slot,
    );
  };
  return stableStringify(left.map(keyOf).sort()) !== stableStringify(right.map(keyOf).sort());
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(",")}}`;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readBoolean(value: unknown) {
  return value === true;
}

function readLineageSha(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
    ? value
    : "unbound";
}

function digestDeploymentHost(value: unknown) {
  return typeof value === "string" && /^[a-z0-9.-]+$/u.test(value)
    ? createHash("sha256").update(value).digest("hex")
    : "unbound";
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
