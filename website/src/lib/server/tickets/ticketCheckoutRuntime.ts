import type { TicketCommercialSnapshot } from "../../tickets/ticketCommercialTerms";
import type { PublicLocale } from "../../publicLocale";
import "server-only";

import { createHash } from "node:crypto";

import type Stripe from "stripe";

import {
  buildSealedTicketCheckoutProviderRequest,
  buildTicketCheckoutProviderRequest,
  TICKET_CHECKOUT_PROVIDER_REQUEST_VERSION,
} from "./ticketCheckoutProviderRequest";

const PROVIDER_IDEMPOTENCY_RETRY_BUDGET_MS = 23 * 60 * 60 * 1_000;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const CHECKOUT_ACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type TicketCheckoutCommand = Readonly<{
  environment: "test" | "live";
  stripeAccountId: string | null;
  providerRequestOrigin: string;
  providerRequestCreatedAt: string;
  canaryRunId: string | null;
  idempotencyKeyHash: string;
  requestHash: string;
  purchaseBrowserVerifier?: string;
  checkoutExpiresAt?: string | null;
  /** Page language for Stripe Checkout; not part of the request identity hash. */
  locale?: PublicLocale | null;
  eventSessionId: string;
  checkInMode: "legacy_qr" | "wallet_swipe";
  walletReadinessValid: boolean;
  publicCode: string;
  eventId: string;
  eventSlug: string;
  eventDate: string;
  eventTitle: string;
  amountYen: number;
  totalQuantity: number;
  items: readonly Readonly<{
    ticketTypeId: string;
    label: string;
    quantity: number;
    unitPriceYen: number;
    commercial?: TicketCommercialSnapshot;
  }>[];
}>;

export type TicketCheckoutClaim = Readonly<{
  action: "claimed" | "reused" | "conflict" | "rejected" | "not_found";
  reason?: string;
  checkoutActionId?: string;
  checkoutExpiresAt?: string | null;
  orderId?: string;
  publicCode?: string;
  providerIdempotencyKey?: string;
  state?: "claimed" | "provider_created" | "completed" | "failed" | "expired" | "review_required";
  checkoutSessionId?: string | null;
  createdAt?: string;
  providerRequestVersion?: string | null;
  providerRequestOrigin?: string | null;
  providerRequestCreatedAt?: string | null;
  providerRequestHash?: string | null;
}>;

export type TicketCheckoutProviderResult = Readonly<{
  checkoutSessionId: string;
  expiresAt: string;
}> & (
  | Readonly<{ status: "open"; checkoutUrl: string }>
  | Readonly<{
    status: "complete" | "expired";
    checkoutUrl: null;
    // Provider-signed payment state. `unpaid` on an expired Session is the
    // terminal no-money fact the recovery worker also requires.
    paymentStatus?: "paid" | "unpaid" | "no_payment_required";
  }>
);

export type TicketCheckoutRequestIdentity = Readonly<{
  termsVersion?: string;
  environment: "test" | "live";
  stripeAccountId: string | null;
  eventId: string;
  canaryRunId: string | null;
  items: readonly Readonly<{
    ticketTypeId: string;
    quantity: number;
  }>[];
}>;

type RecordedProviderResult = Readonly<{
  action: "provider_created" | "reused" | "conflict_review" | "rejected" | "not_found";
  reason?: string;
}>;

type SealedProviderRequest = Readonly<{
  action: "sealed" | "reused" | "conflict" | "rejected" | "not_found";
  reason?: string;
  providerRequestVersion?: string;
  providerRequestOrigin?: string;
  providerRequestCreatedAt?: string;
  providerRequestHash?: string;
}>;

export type TicketCheckoutRuntimeDependencies = Readonly<{
  now?: () => number;
  claim(command: TicketCheckoutCommand): Promise<TicketCheckoutClaim>;
  sealProviderRequest(input: Readonly<{
    checkoutActionId: string;
    requestHash: string;
    providerRequestVersion: string;
    providerRequestOrigin: string;
    providerRequestCreatedAt: string;
    providerRequestHash: string;
  }>): Promise<SealedProviderRequest>;
  createProviderSession(input: Readonly<{
    checkoutActionId: string;
    orderId: string;
    publicCode: string;
    providerIdempotencyKey: string;
    stripeAccountId: string | null;
    parameters: Stripe.Checkout.SessionCreateParams;
  }>): Promise<TicketCheckoutProviderResult>;
  retrieveProviderSession(input: Readonly<{
    checkoutActionId: string;
    orderId: string;
    checkoutSessionId: string;
    stripeAccountId: string | null;
  }>): Promise<TicketCheckoutProviderResult>;
  recordProviderResult(input: Readonly<{
    checkoutActionId: string;
    requestHash: string;
    checkoutSessionId: string;
    providerResponseHash: string;
    providerExpiresAt: string;
  }>): Promise<RecordedProviderResult>;
  reconcileProviderResult(input: Readonly<{
    checkoutActionId: string;
    requestHash: string;
    providerIdempotencyKey: string;
    checkoutSessionId: string;
    providerResponseHash: string;
    providerExpiresAt: string;
  }>): Promise<RecordedProviderResult>;
}>;

export class TicketCheckoutRuntimeError extends Error {
  readonly code:
    | "checkout_claim_rejected"
    | "checkout_idempotency_conflict"
    | "checkout_provider_reconciliation_required"
    | "checkout_provider_response_invalid"
    | "checkout_provider_result_conflict"
    | "checkout_provider_result_rejected"
    | "checkout_replay_budget_exceeded";

  readonly reason?: string;

  constructor(code: TicketCheckoutRuntimeError["code"], reason?: string) {
    super(code);
    this.name = "TicketCheckoutRuntimeError";
    this.code = code;
    this.reason = reason;
  }
}

export function createTicketCheckoutIdempotencyHash(rawKey: string) {
  if (!CHECKOUT_ACTION_ID_PATTERN.test(rawKey)) {
    throw new Error("checkout_idempotency_key_invalid");
  }
  return `sha256:${createHash("sha256").update(rawKey, "utf8").digest("hex")}`;
}

export function createTicketCheckoutRequestHash(command: TicketCheckoutRequestIdentity) {
  const items = command.items.map((item) => ({
    ticketTypeId: item.ticketTypeId,
    quantity: item.quantity,
  })).sort((left, right) => left.ticketTypeId.localeCompare(right.ticketTypeId, "en"));
  return `sha256:${createHash("sha256").update(JSON.stringify({
    // Only public intent belongs in this identity. Event-session mode, labels,
    // prices and other catalog fields are server-selected snapshots. Including
    // them makes a response-loss retry conflict after an Owner drains sales or
    // edits the catalog, even though Stripe may already have accepted it.
    schemaVersion: "ghost.ticket-checkout-intent.v28",
    environment: command.environment,
    stripeAccountId: command.stripeAccountId,
    eventId: command.eventId,
    items,
    ...(command.canaryRunId === null ? {} : { canaryRunId: command.canaryRunId }),
    ...(command.termsVersion === undefined ? {} : { termsVersion: command.termsVersion }),
  }), "utf8").digest("hex")}`;
}

export async function executeTicketCheckout(
  command: TicketCheckoutCommand,
  dependencies: TicketCheckoutRuntimeDependencies,
) {
  const claim = await dependencies.claim(command);
  if (claim.action === "conflict") {
    throw new TicketCheckoutRuntimeError("checkout_idempotency_conflict");
  }
  if (claim.action !== "claimed" && claim.action !== "reused") {
    throw new TicketCheckoutRuntimeError("checkout_claim_rejected", claim.reason);
  }

  const authority = readClaimAuthority(claim);
  if (claim.state === "failed" || claim.state === "expired" || claim.state === "review_required") {
    throw new TicketCheckoutRuntimeError("checkout_claim_rejected");
  }

  if (
    (claim.state === "provider_created" || claim.state === "completed")
    && claim.checkoutSessionId
  ) {
    const providerResult = await dependencies.retrieveProviderSession({
      checkoutActionId: authority.checkoutActionId,
      orderId: authority.orderId,
      checkoutSessionId: claim.checkoutSessionId,
      stripeAccountId: command.stripeAccountId,
    });
    if (providerResult.checkoutSessionId !== claim.checkoutSessionId) {
      throw new TicketCheckoutRuntimeError("checkout_provider_response_invalid");
    }
    if (providerResult.status === "open") return buildResult("reused", authority, providerResult);
    const originalRequest = buildSealedTicketCheckoutProviderRequest({
      snapshot: { ...command, checkoutExpiresAt: claim.checkoutExpiresAt ?? command.checkoutExpiresAt },
      origin: claim.providerRequestOrigin ?? "",
      requestCreatedAt: claim.providerRequestCreatedAt ?? "",
      checkoutActionId: authority.checkoutActionId,
      orderId: authority.orderId,
      canaryRunId: command.canaryRunId,
    }, claim.providerRequestHash ?? "", command.locale ?? null);
    if (claim.providerRequestVersion !== originalRequest.version
      || claim.providerRequestHash !== originalRequest.hash) {
      throw new TicketCheckoutRuntimeError("checkout_provider_reconciliation_required");
    }
    return buildResult("reused", authority, providerResult,
      originalRequest.parameters.success_url, originalRequest.parameters.cancel_url);
  }

  if (claim.state !== "claimed" || claim.checkoutSessionId) {
    throw new TicketCheckoutRuntimeError("checkout_claim_rejected");
  }
  if (!isWithinProviderRetryBudget(claim.createdAt, (dependencies.now ?? Date.now)())) {
    throw new TicketCheckoutRuntimeError("checkout_provider_reconciliation_required");
  }

  const sealMissing = !claim.providerRequestVersion
    || !claim.providerRequestOrigin
    || !claim.providerRequestCreatedAt
    || !claim.providerRequestHash;
  const providerRequestInput = {
    snapshot: {...command, checkoutExpiresAt:claim.checkoutExpiresAt ?? command.checkoutExpiresAt},
    origin: claim.providerRequestOrigin ?? command.providerRequestOrigin,
    // A reused claim that was never sealed must rebuild deterministically:
    // the durable action creation time keeps concurrent retries byte-identical
    // so exactly one seal wins the CAS below instead of conflicting at random.
    requestCreatedAt: claim.providerRequestCreatedAt
      ?? (claim.action === "claimed" ? command.providerRequestCreatedAt : claim.createdAt!),
    checkoutActionId: authority.checkoutActionId,
    orderId: authority.orderId,
    canaryRunId: command.canaryRunId,
  };
  // A new seal uses the buyer's page language; an existing seal is rebuilt in
  // whichever language (or pre-language form) it was created with.
  const providerRequest = claim.action === "claimed" || sealMissing
    ? buildTicketCheckoutProviderRequest({ ...providerRequestInput, locale: command.locale ?? null })
    : buildSealedTicketCheckoutProviderRequest(providerRequestInput, claim.providerRequestHash ?? "", command.locale ?? null);
  if (claim.action === "claimed" || sealMissing) {
    // `claimed` with no sealed request is proof no provider call was sent:
    // every code path calls Stripe only after the seal commits. The seal RPC
    // is a CAS — an already-sealed identical request replays as "reused",
    // while a different seal is a deterministic conflict for review.
    const sealed = await dependencies.sealProviderRequest({
      checkoutActionId: authority.checkoutActionId,
      requestHash: command.requestHash,
      providerRequestVersion: providerRequest.version,
      providerRequestOrigin: providerRequest.origin,
      providerRequestCreatedAt: providerRequest.createdAt,
      providerRequestHash: providerRequest.hash,
    });
    if (
      (sealed.action !== "sealed" && sealed.action !== "reused")
      || sealed.providerRequestVersion !== providerRequest.version
      || sealed.providerRequestOrigin !== providerRequest.origin
      || sealed.providerRequestCreatedAt !== providerRequest.createdAt
      || sealed.providerRequestHash !== providerRequest.hash
    ) {
      throw new TicketCheckoutRuntimeError("checkout_provider_reconciliation_required");
    }
  } else if (
    claim.providerRequestVersion !== TICKET_CHECKOUT_PROVIDER_REQUEST_VERSION
    || claim.providerRequestOrigin !== providerRequest.origin
    || claim.providerRequestCreatedAt !== providerRequest.createdAt
    || claim.providerRequestHash !== providerRequest.hash
  ) {
    throw new TicketCheckoutRuntimeError("checkout_provider_reconciliation_required");
  }

  const providerResult = validateProviderResult(await dependencies.createProviderSession({
    checkoutActionId: authority.checkoutActionId,
    orderId: authority.orderId,
    publicCode: authority.publicCode,
    providerIdempotencyKey: authority.providerIdempotencyKey,
    stripeAccountId: command.stripeAccountId,
    parameters: providerRequest.parameters,
  }));
  const providerResponseHash = createTicketCheckoutProviderResponseHash({
    ...providerResult,
    checkoutActionId: authority.checkoutActionId,
    eventSessionId: command.eventSessionId,
    checkInMode: command.checkInMode,
  });
  const persistenceInput = {
    checkoutActionId: authority.checkoutActionId,
    requestHash: command.requestHash,
    checkoutSessionId: providerResult.checkoutSessionId,
    providerResponseHash,
    providerExpiresAt: providerResult.expiresAt,
  } as const;
  const recorded = claim.action === "claimed"
    ? await dependencies.recordProviderResult(persistenceInput)
    : await dependencies.reconcileProviderResult({
      ...persistenceInput,
      providerIdempotencyKey: authority.providerIdempotencyKey,
    });
  if (recorded.action === "conflict_review") {
    throw new TicketCheckoutRuntimeError("checkout_provider_result_conflict");
  }
  if (recorded.action !== "provider_created" && recorded.action !== "reused") {
    throw new TicketCheckoutRuntimeError("checkout_provider_result_rejected");
  }

  return buildResult(claim.action === "claimed" ? "created" : "reused", authority, providerResult,
    providerRequest.parameters.success_url, providerRequest.parameters.cancel_url);
}

function readClaimAuthority(claim: TicketCheckoutClaim) {
  if (
    !claim.checkoutActionId
    || !CHECKOUT_ACTION_ID_PATTERN.test(claim.checkoutActionId)
    || !claim.orderId
    || !CHECKOUT_ACTION_ID_PATTERN.test(claim.orderId)
    || !claim.publicCode
    || !/^GT-[A-Z0-9]{10}$/u.test(claim.publicCode)
    || !claim.providerIdempotencyKey
    || !/^ghost-ticket-checkout-v28-[0-9a-f-]{36}$/iu.test(claim.providerIdempotencyKey)
  ) {
    throw new TicketCheckoutRuntimeError("checkout_claim_rejected");
  }
  return {
    checkoutActionId: claim.checkoutActionId,
    orderId: claim.orderId,
    publicCode: claim.publicCode,
    providerIdempotencyKey: claim.providerIdempotencyKey,
  } as const;
}

function validateProviderResult(result: TicketCheckoutProviderResult) {
  const expiry = Date.parse(result.expiresAt);
  if (!CHECKOUT_SESSION_ID_PATTERN.test(result.checkoutSessionId)
    || !Number.isFinite(expiry)
    || new Date(expiry).toISOString() !== result.expiresAt) {
    throw new TicketCheckoutRuntimeError("checkout_provider_response_invalid");
  }
  if ((result.status === "complete" || result.status === "expired") && result.checkoutUrl === null) {
    return result;
  }
  let url: URL;
  try {
    if (typeof result.checkoutUrl !== "string") throw new Error("missing_checkout_url");
    url = new URL(result.checkoutUrl);
  } catch {
    throw new TicketCheckoutRuntimeError("checkout_provider_response_invalid");
  }
  if (
    result.status !== "open"
    || url.protocol !== "https:"
    || url.hostname !== "checkout.stripe.com"
    || url.username
    || url.password
    || !Number.isFinite(expiry)
    || new Date(expiry).toISOString() !== result.expiresAt
  ) {
    throw new TicketCheckoutRuntimeError("checkout_provider_response_invalid");
  }
  return result;
}

export function createTicketCheckoutProviderResponseHash(
  result: Pick<TicketCheckoutProviderResult, "checkoutSessionId" | "expiresAt"> & Readonly<{
    checkoutActionId: string;
    eventSessionId: string;
    checkInMode: "legacy_qr" | "wallet_swipe";
  }>,
) {
  // Checkout URLs can disappear after completion. The stable provider binding
  // is the immutable Session id plus its provider expiry, which can be rebuilt
  // from a signed webhook's PaymentIntent -> Checkout Session lookup.
  return createHash("sha256").update(JSON.stringify({
    checkoutSessionId: result.checkoutSessionId,
    expiresAt: result.expiresAt,
    checkoutActionId: result.checkoutActionId,
    eventSessionId: result.eventSessionId,
    checkInMode: result.checkInMode,
  }), "utf8").digest("hex");
}

function isWithinProviderRetryBudget(createdAt: string | undefined, now: number) {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return Number.isFinite(created)
    && new Date(created).toISOString() === createdAt
    && now >= created
    && now - created < PROVIDER_IDEMPOTENCY_RETRY_BUDGET_MS;
}

function buildResult(
  action: "created" | "reused",
  authority: ReturnType<typeof readClaimAuthority>,
  providerResult: TicketCheckoutProviderResult,
  statusUrl?: string,
  terminalUnpaidUrl?: string,
) {
  const validated = validateProviderResult(providerResult);
  // This is a return to a server-backed view, never evidence of payment or
  // authorization to issue tickets. Every URL comes from the sealed request,
  // not from Stripe's mutable fields or the current request host.
  //
  // A provider-verified expired+unpaid Session is terminal: nothing was paid
  // and nothing can still be paid on it. Sending the browser to the purchase
  // status view would show "confirming payment" forever; the sealed cancel
  // target is the terminal unpaid surface where a new purchase is always an
  // explicit fresh action. Paid/complete/unknown states keep reconciling on
  // the status view and never auto-create another Session.
  const checkoutUrl = validated.status === "open"
    ? validated.checkoutUrl
    : validated.status === "expired"
        && validated.paymentStatus === "unpaid"
        && terminalUnpaidUrl
      ? terminalUnpaidUrl
      : statusUrl?.replace(
        "{CHECKOUT_SESSION_ID}",
        encodeURIComponent(validated.checkoutSessionId),
      );
  if (!checkoutUrl) throw new TicketCheckoutRuntimeError("checkout_provider_response_invalid");
  return Object.freeze({
    action,
    checkoutActionId: authority.checkoutActionId,
    orderId: authority.orderId,
    checkoutUrl,
  });
}
