import { createHash } from "node:crypto";

import type Stripe from "stripe";

const GATE_C_LEDGER_ENV = "GATE_C_SYNTHETIC_LEDGER_V7_JSON";
const NAMESPACE = /^ghost-gate-c-v7r4-[a-z0-9-]{16,64}$/u;
const EXECUTION_ID = /^gate-c-[a-f0-9]{32}$/u;
const CYCLE_ID = /^gate-c-[a-f0-9]{32}:(?:card_setup|refundable_deposit)$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;

export type GateCSyntheticCycle = "card_setup" | "refundable_deposit";

export type GateCSyntheticScope = Readonly<{
  executionId: string;
  cycleId: string;
  cycle: GateCSyntheticCycle;
  namespace: string;
  webhookEventId?: string;
  refundCaseId?: string;
}>;

type GateCLedger = Readonly<{
  namespace: string;
  turnstileToken: string;
  cycles: Readonly<Record<GateCSyntheticCycle, unknown>>;
}>;

export function gateCSyntheticModeConfigured() {
  const configured = Boolean(process.env[GATE_C_LEDGER_ENV]);
  // G-41: the synthetic ledger reaching a production deployment silently halts
  // every non-scoped webhook/refund worker call. Reject the configuration
  // outright so the misconfiguration fails loudly (distinct error surfaced in
  // the first worker/route call and any preflight) instead of degrading to
  // per-event `gate_c_synthetic_webhook_scope_required` faults.
  if (configured && process.env.VERCEL_ENV === "production") {
    throw new Error("gate_c_synthetic_forbidden_in_production");
  }
  return configured;
}

export function expectedGateCSyntheticScope(
  namespace: string,
  cycle: GateCSyntheticCycle,
): GateCSyntheticScope {
  if (!NAMESPACE.test(namespace)) {
    throw new Error("gate_c_synthetic_namespace_invalid");
  }

  const executionId = `gate-c-${sha256(namespace).slice(0, 32)}`;
  return Object.freeze({
    executionId,
    cycleId: `${executionId}:${cycle}`,
    cycle,
    namespace,
  });
}

export function readGateCSyntheticScopeFromRequest(request: Request) {
  const values = {
    executionId: request.headers.get("x-pure-gate-c-execution-id")?.trim() ?? "",
    cycleId: request.headers.get("x-pure-gate-c-cycle-id")?.trim() ?? "",
    namespace: request.headers.get("x-pure-gate-c-namespace")?.trim() ?? "",
  };

  if (!Object.values(values).some(Boolean)) {
    return null;
  }

  const ledger = readGateCLedger();
  const cycle = readCycleFromId(values.cycleId);
  const expected = expectedGateCSyntheticScope(ledger.namespace, cycle);

  if (
    values.executionId !== expected.executionId ||
    values.cycleId !== expected.cycleId ||
    values.namespace !== expected.namespace
  ) {
    throw new Error("gate_c_synthetic_request_scope_mismatch");
  }

  return expected;
}

export function parseGateCSyntheticWorkerScope(
  value: unknown,
  target: "webhook" | "refund",
) {
  if (!isRecord(value)) {
    throw new Error("gate_c_synthetic_worker_scope_required");
  }

  const cycle = value.cycle;
  if (cycle !== "card_setup" && cycle !== "refundable_deposit") {
    throw new Error("gate_c_synthetic_cycle_invalid");
  }

  const ledger = readGateCLedger();
  const expected = expectedGateCSyntheticScope(ledger.namespace, cycle);
  const candidate: GateCSyntheticScope = {
    executionId: readString(value.executionId),
    cycleId: readString(value.cycleId),
    cycle,
    namespace: readString(value.namespace),
    ...(target === "webhook" ? { webhookEventId: readString(value.webhookEventId) } : {}),
    ...(target === "refund" ? { refundCaseId: readString(value.refundCaseId) } : {}),
  };

  assertGateCSyntheticScope(candidate, expected);
  if (target === "webhook" && !candidate.webhookEventId?.startsWith("evt_")) {
    throw new Error("gate_c_synthetic_webhook_event_invalid");
  }
  if (target === "refund" && !UUID.test(candidate.refundCaseId ?? "")) {
    throw new Error("gate_c_synthetic_refund_case_invalid");
  }

  return Object.freeze(candidate);
}

export function readGateCSyntheticScopeFromStripeEvent(event: Stripe.Event) {
  if (event.livemode) {
    return null;
  }

  const object = event.data.object as Stripe.Event.Data.Object & {
    metadata?: Record<string, string> | null;
  };
  const metadata = object.metadata;
  if (!metadata?.gate_c_namespace) {
    return null;
  }

  const cycle = metadata.gate_c_cycle;
  if (cycle !== "card_setup" && cycle !== "refundable_deposit") {
    throw new Error("gate_c_synthetic_event_cycle_invalid");
  }

  const expected = expectedGateCSyntheticScope(readGateCLedger().namespace, cycle);
  const candidate: GateCSyntheticScope = {
    executionId: metadata.gate_c_execution_id ?? "",
    cycleId: metadata.gate_c_cycle_id ?? "",
    cycle,
    namespace: metadata.gate_c_namespace,
    webhookEventId: event.id,
  };
  assertGateCSyntheticScope(candidate, expected);
  return Object.freeze(candidate);
}

export function gateCSyntheticStripeMetadata(
  scope: GateCSyntheticScope | null,
): Record<string, string> {
  if (!scope) {
    return {};
  }

  return {
    gate_c_execution_id: scope.executionId,
    gate_c_cycle_id: scope.cycleId,
    gate_c_cycle: scope.cycle,
    gate_c_namespace: scope.namespace,
  };
}

export function assertGateCSyntheticScope(
  candidate: GateCSyntheticScope,
  expected = expectedGateCSyntheticScope(candidate.namespace, candidate.cycle),
) {
  if (
    !EXECUTION_ID.test(candidate.executionId) ||
    !CYCLE_ID.test(candidate.cycleId) ||
    candidate.executionId !== expected.executionId ||
    candidate.cycleId !== expected.cycleId ||
    candidate.cycle !== expected.cycle ||
    candidate.namespace !== expected.namespace
  ) {
    throw new Error("gate_c_synthetic_scope_mismatch");
  }
  return true;
}

export function assertGateCSyntheticIdempotency(
  value: string,
  scope: GateCSyntheticScope,
) {
  if (!value.includes(scope.namespace) || !value.includes(scope.cycle)) {
    throw new Error("gate_c_synthetic_idempotency_scope_mismatch");
  }
  return true;
}

export function assertGateCSyntheticWebhookClaimCandidate(
  candidate: Record<string, unknown> & { environment: unknown },
  scope: GateCSyntheticScope,
) {
  assertGateCSyntheticScope(scope);
  const eventScope = readGateCSyntheticScopeFromStripeEvent(
    candidate.payload_json as Stripe.Event,
  );
  if (
    candidate.environment !== "test" ||
    candidate.locked_by !== null ||
    !["received", "retry"].includes(String(candidate.processing_status)) ||
    candidate.stripe_event_id !== scope.webhookEventId ||
    !eventScope ||
    eventScope.executionId !== scope.executionId ||
    eventScope.cycleId !== scope.cycleId ||
    eventScope.namespace !== scope.namespace ||
    eventScope.webhookEventId !== scope.webhookEventId
  ) {
    throw new Error("gate_c_synthetic_webhook_candidate_scope_mismatch");
  }
  return true;
}

export function assertGateCSyntheticRefundClaimCandidate(
  candidate: Record<string, unknown> & { environment: unknown },
  scope: GateCSyntheticScope,
) {
  assertGateCSyntheticScope(scope);
  if (
    scope.cycle !== "refundable_deposit" ||
    candidate.environment !== "test" ||
    candidate.id !== scope.refundCaseId ||
    candidate.locked_by !== null ||
    candidate.status !== "approved" ||
    typeof candidate.stripe_idempotency_key !== "string"
  ) {
    throw new Error("gate_c_synthetic_refund_candidate_scope_mismatch");
  }
  assertGateCSyntheticIdempotency(candidate.stripe_idempotency_key, scope);
  return true;
}

export function gateCSyntheticScopeDigest(scope: GateCSyntheticScope) {
  return sha256(
    JSON.stringify({
      cycle: scope.cycle,
      cycleId: scope.cycleId,
      executionId: scope.executionId,
      namespace: scope.namespace,
    }),
  );
}

export function readGateCSyntheticTurnstileToken(scope: GateCSyntheticScope) {
  assertGateCSyntheticScope(scope);
  const ledger = readGateCLedger();
  if (ledger.namespace !== scope.namespace || typeof ledger.turnstileToken !== "string") {
    throw new Error("gate_c_synthetic_turnstile_contract_invalid");
  }
  const token = ledger.turnstileToken.trim();
  if (token.length < 8 || token.length > 2048) {
    throw new Error("gate_c_synthetic_turnstile_token_invalid");
  }
  return token;
}

function readGateCLedger(): GateCLedger {
  const raw = process.env[GATE_C_LEDGER_ENV];
  if (!raw) {
    throw new Error("gate_c_synthetic_ledger_unavailable");
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("gate_c_synthetic_ledger_invalid_json");
  }

  if (
    !isRecord(value) ||
    !NAMESPACE.test(readString(value.namespace)) ||
    typeof value.turnstileToken !== "string" ||
    !isRecord(value.cycles) ||
    !Object.hasOwn(value.cycles, "card_setup") ||
    !Object.hasOwn(value.cycles, "refundable_deposit")
  ) {
    throw new Error("gate_c_synthetic_ledger_invalid");
  }

  return value as GateCLedger;
}

function readCycleFromId(cycleId: string): GateCSyntheticCycle {
  if (cycleId.endsWith(":card_setup")) return "card_setup";
  if (cycleId.endsWith(":refundable_deposit")) return "refundable_deposit";
  throw new Error("gate_c_synthetic_cycle_id_invalid");
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
