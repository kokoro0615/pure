import "server-only";

import { createHash } from "node:crypto";

import type { TicketRefundResolveCommand } from "./ticketManagerOperations";

type DbRow = Record<string, unknown>;

export function maskTicketEmail(value: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1 || at === normalized.length - 1 || normalized.length > 320) return "•••@•••";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !label)) return "•••@•••";
  const suffix = labels.at(-1) ?? "";
  return `${local[0]}•••@${labels[0][0]}•••.${suffix}`;
}

export function verifyTicketManagerRefundAllocation(
  command: TicketRefundResolveCommand,
  refund: DbRow,
  order: DbRow,
  admissions: readonly DbRow[],
  observations: readonly DbRow[],
): Readonly<{ ok: true; decision: "apply" | "dismiss_no_money_moved"; serials: readonly number[] }>
  | Readonly<{ ok: false; reason: string }> {
  const authority = projectTicketManagerRefundFacts(refund, order, admissions, observations);
  if (authority.observationHistoryState === "legacy_incomplete") {
    return { ok: false, reason: "refund_observation_history_incomplete" };
  }
  if (
    command.observationVersion !== authority.observationVersion
    || command.observationHash !== authority.observationHash
  ) {
    return { ok: false, reason: "refund_observation_set_mismatch" };
  }
  const moneyMoved = authority.moneyMayHaveMoved;
  if (command.resolution === "dismiss_no_money_moved") {
    return moneyMoved ? { ok: false, reason: "successful_refund_requires_allocation" }
      : { ok: true, decision: "dismiss_no_money_moved", serials: [] };
  }
  if (!moneyMoved || !authority.authorityResolvable) {
    return { ok: false, reason: "refund_observation_authority_ambiguous" };
  }
  if (command.allocations.length !== authority.authoritativeAdmissionSerials.length) {
    return { ok: false, reason: "allocation_amount_mismatch" };
  }
  const prices = ticketTypePrices(order.items_json);
  const byId = new Map(admissions.map((admission) => [requireUuid(admission.id), admission]));
  let total = 0;
  for (const requested of command.allocations) {
    const admission = byId.get(requested.admissionId);
    if (!admission) return { ok: false, reason: "admission_not_found" };
    const price = prices.get(requireString(admission.ticket_type_id));
    if (price === undefined || price !== requested.amountMinor) {
      return { ok: false, reason: "allocation_amount_mismatch" };
    }
    if (
      command.resolution === "apply_and_void"
      && admission.status !== "issued"
      && admission.status !== "void"
    ) {
      return { ok: false, reason: "admission_state_invalid" };
    }
    if (
      command.resolution === "record_admitted_exception"
      && admission.status !== "admitted"
      && admission.status !== "issued"
    ) {
      return { ok: false, reason: "admission_state_invalid" };
    }
    total += price;
  }
  const selectedSerials = command.allocations
    .map(({ admissionId }) => requirePositiveInteger(byId.get(admissionId)?.serial))
    .sort((left, right) => left - right);
  if (!equalNumbers(selectedSerials, authority.authoritativeAdmissionSerials)) {
    return { ok: false, reason: "refund_observation_selection_mismatch" };
  }
  if (total !== authority.authoritativeAmountMinor) {
    return { ok: false, reason: "allocation_amount_mismatch" };
  }
  if (
    command.resolution === "record_admitted_exception"
    && !command.allocations.some(({ admissionId }) => byId.get(admissionId)?.status === "admitted")
  ) {
    return { ok: false, reason: "admission_state_invalid" };
  }
  return {
    ok: true,
    decision: "apply",
    serials: selectedSerials,
  };
}

export function projectTicketManagerRefundFacts(
  refund: DbRow,
  order: DbRow,
  admissions: readonly DbRow[],
  observations: readonly DbRow[],
) {
  const refundEventId = requireUuid(refund.id);
  const observationVersion = requirePositiveInteger(refund.observation_version);
  const observationHash = requireHash(refund.observation_set_hash);
  const observationHistoryState = refund.observation_history_state;
  const observationHistoryReason = nullableBoundedText(refund.observation_history_reason, 80);
  if (
    (observationHistoryState === "complete" && observationHistoryReason !== null)
    || (
      observationHistoryState === "legacy_incomplete"
      && observationHistoryReason !== "legacy_conflict_observation_history_unrecoverable"
    )
    || (observationHistoryState !== "complete" && observationHistoryState !== "legacy_incomplete")
  ) throw projectionError();
  if (observations.length < 1 || observations.length > 200) throw projectionError();
  const safeObservations = [...observations]
    .map((observation) => {
      if (requireUuid(observation.ticket_refund_event_id) !== refundEventId) throw projectionError();
      const version = requirePositiveInteger(observation.observation_version);
      const evidenceHash = requireHash(observation.facts_hash);
      const amountMinor = requirePositiveInteger(observation.amount_yen);
      const providerStatus = observation.provider_status;
      if (providerStatus !== "succeeded" && providerStatus !== "failed" && providerStatus !== "canceled") {
        throw projectionError();
      }
      if (!Array.isArray(observation.input_admission_serials)) throw projectionError();
      const admissionSerials = observation.input_admission_serials
        .map(requirePositiveInteger)
        .sort((left, right) => left - right);
      if (new Set(admissionSerials).size !== admissionSerials.length || admissionSerials.some((serial) => serial > 20)) {
        throw projectionError();
      }
      if (typeof observation.input_valid !== "boolean") throw projectionError();
      return {
        version,
        evidenceHash,
        amountMinor,
        providerStatus,
        admissionSerials,
        inputValid: observation.input_valid,
        validationReason: nullableBoundedText(observation.validation_reason, 240),
        observedAt: canonicalInstant(observation.observed_at),
      } as const;
    })
    .sort((left, right) => left.version - right.version);
  if (
    safeObservations.some((observation, index) => observation.version !== index + 1)
    || safeObservations.at(-1)?.version !== observationVersion
  ) throw projectionError();
  let computedHash = safeObservations[0].evidenceHash;
  for (const observation of safeObservations.slice(1)) {
    computedHash = createHash("sha256")
      .update(`${computedHash}:${observation.evidenceHash}`, "utf8")
      .digest("hex");
  }
  if (computedHash !== observationHash) throw projectionError();

  if (observationHistoryState === "legacy_incomplete") {
    return Object.freeze({
      observationVersion,
      observationHash,
      observationHistoryState,
      observationHistoryReason,
      // The first-seen amount remains a safe display fact. It is deliberately
      // not used as allocation authority because overwritten conflict JSON
      // cannot reconstruct the missing provider observation sequence.
      authoritativeAmountMinor: requirePositiveInteger(refund.amount_yen),
      authoritativeAdmissionSerials: Object.freeze([] as number[]),
      moneyMayHaveMoved: true,
      authorityResolvable: false,
      observations: Object.freeze(safeObservations),
    });
  }

  const succeeded = safeObservations.filter((observation) => observation.providerStatus === "succeeded");
  const authoritativeAmountMinor = succeeded.length === 0
    ? requirePositiveInteger(refund.amount_yen)
    : Math.max(...succeeded.map((observation) => observation.amountMinor));
  const orderAmount = requirePositiveInteger(order.amount_yen);
  const fullRefundObserved = succeeded.some((observation) => observation.amountMinor === orderAmount);
  const authoritativeAdmissionSerials = fullRefundObserved
    ? admissions.map((admission) => requirePositiveInteger(admission.serial)).sort((left, right) => left - right)
    : [...new Set(succeeded.flatMap((observation) => observation.admissionSerials))].sort((left, right) => left - right);
  const prices = ticketTypePrices(order.items_json);
  const admissionPriceTotal = admissions
    .filter((admission) => authoritativeAdmissionSerials.includes(requirePositiveInteger(admission.serial)))
    .reduce((sum, admission) => sum + (prices.get(requireString(admission.ticket_type_id)) ?? 0), 0);
  const authorityResolvable = succeeded.length > 0
    && (fullRefundObserved || succeeded.every((observation) => observation.inputValid))
    && authoritativeAmountMinor <= orderAmount
    && authoritativeAdmissionSerials.length > 0
    && admissionPriceTotal === authoritativeAmountMinor;

  return Object.freeze({
    observationVersion,
    observationHash,
    observationHistoryState,
    observationHistoryReason,
    authoritativeAmountMinor,
    authoritativeAdmissionSerials: Object.freeze(authoritativeAdmissionSerials),
    moneyMayHaveMoved: refund.money_may_have_moved === true || succeeded.length > 0,
    authorityResolvable,
    observations: Object.freeze(safeObservations),
  });
}

function ticketTypePrices(value: unknown) {
  if (!Array.isArray(value)) throw projectionError();
  const prices = new Map<string, number>();
  for (const item of value) {
    if (!isRecord(item)) throw projectionError();
    const id = requireBoundedText(item.ticketTypeId, 200);
    const price = requirePositiveInteger(item.unitPriceYen);
    const existing = prices.get(id);
    if (existing !== undefined && existing !== price) throw projectionError();
    prices.set(id, price);
  }
  return prices;
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw projectionError();
  }
  return value;
}

function requireString(value: unknown) {
  if (typeof value !== "string") throw projectionError();
  return value;
}

function requireBoundedText(value: unknown, maximum: number) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > maximum) {
    throw projectionError();
  }
  return value;
}

function nullableBoundedText(value: unknown, maximum: number) {
  if (value === null || value === undefined) return null;
  return requireBoundedText(value, maximum);
}

function requireHash(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw projectionError();
  return value;
}

function canonicalInstant(value: unknown) {
  if (typeof value !== "string") throw projectionError();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw projectionError();
  return new Date(milliseconds).toISOString();
}

function equalNumbers(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requirePositiveInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw projectionError();
  return value as number;
}

function projectionError() {
  const error = new Error("TICKET_MANAGER_PROJECTION_INVALID");
  error.name = "TicketManagerProjectionError";
  return error;
}

function isRecord(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
