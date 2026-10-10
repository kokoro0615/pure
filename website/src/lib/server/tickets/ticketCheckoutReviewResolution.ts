import { createHash } from "node:crypto";

import "server-only";

import type Stripe from "stripe";

import { readRuntimeEnvironment } from "../runtimeEnvironment";
import { getStripeClient, stripeRequestOptions } from "../stripe";
import { createSupabaseAdminClient } from "../supabaseAdmin";
import { fulfillTicketOrder } from "./ticketOrders";
import { readVerifiedTicketCheckoutEvidence } from "./ticketProviderEvidence";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,200}$/u;
const RESOLVE_ACTION = "resolve_ticket_checkout_review_v1";

export type TicketCheckoutReviewQueueItem = Readonly<{
  checkoutActionId: string;
  orderId: string;
  publicCode: string;
  orderStatus: string;
  orderAmountYen: number;
  totalQuantity: number;
  eventId: string;
  eventDate: string;
  checkInMode: "legacy_qr" | "wallet_swipe";
  eventSessionId: string;
  environment: "test" | "live";
  stripeAccountId: string | null;
  stripeAccountKey: string;
  reviewReason: string | null;
  lastOutcome: string | null;
  checkoutSessionId: string | null;
  providerExpiresAt: string | null;
  providerEvidenceHash: string | null;
  providerObservedAt: string | null;
  conflictCount: number;
  reconciliationCount: number;
  createdAt: string;
  reviewEnteredAt: string;
  deadlineAt: string;
  slaBreached: boolean;
}>;

export type TicketCheckoutReviewDecision =
  "requeue" | "acknowledge" | "fulfill" | "escalate";

export type TicketCheckoutReviewResult =
  | Readonly<{ ok: true; action: string; state?: string; orderStatus?: string; reused?: boolean }>
  | Readonly<{ ok: false; error: string; reason?: string }>;

export async function listTicketCheckoutReviewQueue(
  environment: "test" | "live",
): Promise<readonly TicketCheckoutReviewQueueItem[]> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "list_ticket_checkout_review_queue_v1",
    { p_environment: environment, p_limit: 100 },
  );
  if (error || !isRecord(data) || data.action !== "listed" || !Array.isArray(data.items)) {
    throw new Error("ticket_checkout_review_queue_unavailable");
  }
  return data.items.filter(isRecord).map(readQueueItem).filter(
    (item): item is TicketCheckoutReviewQueueItem => item !== null,
  );
}

/**
 * Resolve one review_required checkout action. `requeue`, `acknowledge` and
 * `escalate` are single CAS calls; `fulfill` re-fetches provider evidence
 * first, then runs
 * mark_provider_paid -> fulfill_ticket_order_v35 -> acknowledge so every
 * money-adjacent invariant (refund hold, dispute gate, timing review) is
 * re-evaluated by the audited fulfill function itself.
 */
export async function resolveTicketCheckoutReview(input: Readonly<{
  actorAdminId: string;
  idempotencyKey: string;
  checkoutActionId: string;
  decision: TicketCheckoutReviewDecision;
  reason: string;
  /**
   * Operator-supplied provider Session to bind on `fulfill` when none was
   * recorded on the action. Still re-fetched and fully re-verified — this is
   * a pointer to provider facts, never the facts themselves.
   */
  providerSessionId?: string;
  /**
   * Optional operator-asserted Session expiry (ISO timestamp). When present
   * it must agree with the re-fetched Session's `expires_at`; it is never
   * bound as the provider fact itself.
   */
  providerExpiresAt?: string;
}>): Promise<TicketCheckoutReviewResult> {
  if (
    !UUID_PATTERN.test(input.actorAdminId)
    || !UUID_PATTERN.test(input.checkoutActionId)
    || !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
    || !input.reason.trim()
    || input.reason.trim().length > 240
    || (input.providerSessionId !== undefined
      && !CHECKOUT_SESSION_ID_PATTERN.test(input.providerSessionId))
    || (input.providerExpiresAt !== undefined
      && !Number.isFinite(Date.parse(input.providerExpiresAt)))
  ) {
    return { ok: false, error: "invalid_request" };
  }
  if (
    input.decision === "requeue"
    || input.decision === "acknowledge"
    || input.decision === "escalate"
  ) {
    // `escalate` is the terminal path for a binding that can never produce
    // reconciling provider evidence — no provider facts are gathered; the RPC
    // fails the action and files an external_finance_reviews row.
    return callResolve(input, input.decision, null);
  }
  return fulfillCheckoutReview(input);
}

async function fulfillCheckoutReview(
  input: Readonly<{
    actorAdminId: string;
    idempotencyKey: string;
    checkoutActionId: string;
    reason: string;
    providerSessionId?: string;
    providerExpiresAt?: string;
  }>,
): Promise<TicketCheckoutReviewResult> {
  const queue = await listTicketCheckoutReviewQueue(readEnvironment());
  const item = queue.find((candidate) => candidate.checkoutActionId === input.checkoutActionId);
  if (!item) return { ok: false, error: "not_found" };
  // Prefer the operator-supplied Session when given: it is the only way to
  // bind a review item whose action never recorded one. The RPC re-checks
  // any recorded value, so a conflicting pointer still fails closed.
  const checkoutSessionId = input.providerSessionId
    ?? (item.checkoutSessionId && CHECKOUT_SESSION_ID_PATTERN.test(item.checkoutSessionId)
      ? item.checkoutSessionId
      : null);
  if (!checkoutSessionId) {
    return { ok: false, error: "provider_session_missing" };
  }

  // Re-fetch provider facts at decision time: a queued review item is a stale
  // snapshot, and the resolved Session is the only identity ever trusted.
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripeClient().checkout.sessions.retrieve(
      checkoutSessionId,
      { expand: ["payment_intent"] },
      stripeRequestOptions(item.stripeAccountId, null),
    );
  } catch {
    return { ok: false, error: "provider_lookup_failed" };
  }

  const paymentIntentId = readProviderObjectId(session.payment_intent);
  const paymentIntentCreated = isRecord(session.payment_intent)
    ? session.payment_intent.created : null;
  if (
    session.payment_status !== "paid"
    || session.status !== "complete"
    || !paymentIntentId
    || typeof session.amount_total !== "number"
    || session.amount_total !== item.orderAmountYen
    || session.livemode !== (item.environment === "live")
    || !Number.isSafeInteger(paymentIntentCreated)
  ) {
    return { ok: false, error: "provider_facts_mismatch" };
  }

  let evidence;
  try {
    evidence = readVerifiedTicketCheckoutEvidence({
      eventLivemode: item.environment === "live",
      paymentIntentId,
      session,
    });
  } catch {
    return { ok: false, error: "provider_facts_mismatch" };
  }
  if (
    !evidence
    || evidence.checkoutActionId !== item.checkoutActionId
    || evidence.ticketOrderId !== item.orderId
    || evidence.eventSessionId !== item.eventSessionId
    || evidence.checkInMode !== item.checkInMode
  ) {
    return { ok: false, error: "provider_facts_mismatch" };
  }
  // An operator-asserted expiry must agree with the provider fact at second
  // precision (Session.expires_at is epoch seconds).
  if (
    input.providerExpiresAt !== undefined
    && Math.floor(Date.parse(input.providerExpiresAt) / 1_000) !== session.expires_at
  ) {
    return { ok: false, error: "provider_facts_mismatch" };
  }

  const observedAt = new Date().toISOString();
  const marked = await callResolve(input, "mark_provider_paid", {
    providerSessionId: evidence.checkoutSessionId,
    providerExpiresAt: evidence.providerExpiresAt,
    providerEvidenceHash: createHash("sha256")
      .update(JSON.stringify({
        checkoutActionId: item.checkoutActionId,
        checkoutSessionId: evidence.checkoutSessionId,
        orderId: item.orderId,
        paymentIntentId,
        amountYen: item.orderAmountYen,
        paymentStatus: session.payment_status,
        status: session.status,
        observedAt,
      }), "utf8")
      .digest("hex"),
    providerObservedAt: observedAt,
    providerAmountYen: item.orderAmountYen,
  });
  if (!marked.ok) return marked;
  if (marked.action !== "resolved" && !(marked.action === "reused" && marked.state === "provider_created")) {
    return { ok: false, error: "review_state_changed", reason: marked.action };
  }

  const providerPaidAt = new Date((paymentIntentCreated as number) * 1_000).toISOString();
  const fulfilled = await fulfillTicketOrder({
    providerPaidAt,
    orderId: item.orderId,
    environment: item.environment,
    stripeAccountId: item.stripeAccountId,
    paymentIntentId,
    checkoutSessionId: evidence.checkoutSessionId,
    amountYen: item.orderAmountYen,
    purchaserEmail: readProviderEmail(session),
    totalQuantity: item.totalQuantity,
  });
  if (!fulfilled.ok) {
    // The action is back on provider_created; the recovery worker re-verifies
    // and re-parks it in review if the reject was deterministic.
    return { ok: false, error: "fulfill_rejected", reason: fulfilled.reason };
  }

  const acknowledged = await callResolve(
    { ...input, idempotencyKey: `${input.idempotencyKey}:ack` },
    "acknowledge",
    null,
  );
  if (!acknowledged.ok) {
    return { ok: true, action: "fulfilled", state: "provider_created", orderStatus: "fulfilled" };
  }
  return {
    ok: true,
    action: "fulfilled",
    state: acknowledged.state ?? "completed",
    orderStatus: "fulfilled",
  };
}

async function callResolve(
  input: Readonly<{
    actorAdminId: string;
    idempotencyKey: string;
    checkoutActionId: string;
    reason: string;
  }>,
  decision: "requeue" | "acknowledge" | "mark_provider_paid" | "escalate",
  provider: Readonly<{
    providerSessionId: string;
    providerExpiresAt: string;
    providerEvidenceHash: string;
    providerObservedAt: string;
    providerAmountYen: number;
  }> | null,
): Promise<TicketCheckoutReviewResult> {
  const requestHash = createHash("sha256")
    .update("ghost.ticket-checkout-review.v1\0", "utf8")
    .update(input.checkoutActionId, "utf8").update("\0", "utf8")
    .update(decision, "utf8").update("\0", "utf8")
    .update(provider?.providerSessionId ?? "", "utf8").update("\0", "utf8")
    .update(input.reason.trim(), "utf8")
    .digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc(RESOLVE_ACTION, {
    p_actor_admin_id: input.actorAdminId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
    p_checkout_action_id: input.checkoutActionId,
    p_decision: decision,
    p_reason: input.reason.trim(),
    p_provider_session_id: provider?.providerSessionId ?? null,
    p_provider_expires_at: provider?.providerExpiresAt ?? null,
    p_provider_evidence_hash: provider?.providerEvidenceHash ?? null,
    p_provider_observed_at: provider?.providerObservedAt ?? null,
    p_provider_amount_yen: provider?.providerAmountYen ?? null,
  });
  if (error || !isRecord(data)) {
    throw new Error("ticket_checkout_review_resolve_failed");
  }
  const action = typeof data.action === "string" ? data.action : "";
  if (action === "resolved" || action === "reused") {
    return {
      ok: true,
      action,
      state: typeof data.state === "string" ? data.state : undefined,
      orderStatus: typeof data.orderStatus === "string" ? data.orderStatus : undefined,
      reused: data.reused === true || action === "reused",
    };
  }
  if (action === "conflict") {
    return { ok: false, error: "idempotency_conflict", reason: stringOrUndefined(data.reason) };
  }
  return {
    ok: false,
    error: action === "rejected" ? "rejected" : "resolve_failed",
    reason: stringOrUndefined(data.reason),
  };
}

function readQueueItem(value: Record<string, unknown>): TicketCheckoutReviewQueueItem | null {
  const checkoutActionId = stringOrUndefined(value.checkoutActionId);
  const orderId = stringOrUndefined(value.orderId);
  const eventSessionId = stringOrUndefined(value.eventSessionId);
  const environment = value.environment === "live" ? "live" : "test";
  const checkInMode = value.checkInMode === "wallet_swipe" ? "wallet_swipe" : "legacy_qr";
  if (
    !checkoutActionId || !UUID_PATTERN.test(checkoutActionId)
    || !orderId || !UUID_PATTERN.test(orderId)
    || !eventSessionId || !UUID_PATTERN.test(eventSessionId)
    || typeof value.orderAmountYen !== "number"
    || typeof value.totalQuantity !== "number"
    || typeof value.createdAt !== "string"
    || typeof value.reviewEnteredAt !== "string"
    || typeof value.deadlineAt !== "string"
  ) {
    return null;
  }
  return Object.freeze({
    checkoutActionId,
    orderId,
    publicCode: stringOrUndefined(value.publicCode) ?? "",
    orderStatus: stringOrUndefined(value.orderStatus) ?? "",
    orderAmountYen: value.orderAmountYen,
    totalQuantity: value.totalQuantity,
    eventId: stringOrUndefined(value.eventId) ?? "",
    eventDate: stringOrUndefined(value.eventDate) ?? "",
    checkInMode,
    eventSessionId,
    environment,
    stripeAccountId: stringOrUndefined(value.stripeAccountId) ?? null,
    stripeAccountKey: stringOrUndefined(value.stripeAccountKey) ?? "platform",
    reviewReason: stringOrUndefined(value.reviewReason) ?? null,
    lastOutcome: stringOrUndefined(value.lastOutcome) ?? null,
    checkoutSessionId: stringOrUndefined(value.checkoutSessionId) ?? null,
    providerExpiresAt: stringOrUndefined(value.providerExpiresAt) ?? null,
    providerEvidenceHash: stringOrUndefined(value.providerEvidenceHash) ?? null,
    providerObservedAt: stringOrUndefined(value.providerObservedAt) ?? null,
    conflictCount: typeof value.conflictCount === "number" ? value.conflictCount : 0,
    reconciliationCount: typeof value.reconciliationCount === "number" ? value.reconciliationCount : 0,
    createdAt: value.createdAt,
    reviewEnteredAt: value.reviewEnteredAt,
    deadlineAt: value.deadlineAt,
    slaBreached: value.slaBreached === true,
  });
}

function readEnvironment() {
  return readRuntimeEnvironment();
}

function readProviderObjectId(value: unknown) {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value.id === "string" ? value.id : null;
}

function readProviderEmail(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
