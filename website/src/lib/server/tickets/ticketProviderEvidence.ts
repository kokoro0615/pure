import "server-only";

import { createTicketCheckoutProviderResponseHash } from "./ticketCheckoutRuntime";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live|fake)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;

export type VerifiedTicketCheckoutEvidence = Readonly<{
  ticketOrderId: string;
  checkoutActionId: string;
  eventSessionId: string;
  checkInMode: "legacy_qr" | "wallet_swipe";
  checkoutSessionId: string;
  clientReferenceId: string;
  paymentIntentId: string;
  providerFlow: "ticket_calendar";
  providerResponseHash: string;
  providerExpiresAt: string;
}>;

/**
 * Turn a provider Checkout Session into the narrow evidence accepted by the
 * atomic refund/revocation bridge. Every duplicated identity must agree. A
 * reservation session is unrelated; a malformed ticket-labelled session is a
 * defect and must be retried/dead-lettered by the caller, never guessed.
 *
 * One deliberate exception: pre-v28 Sessions carry `flow: "ticket_calendar"`
 * plus order linkage but none of the checkout-action binding fields the v28
 * request writes (`ticket_checkout_action_id` / `ticket_event_session_id` /
 * `ticket_check_in_mode`). Those sessions are legacy-eligible: return null so
 * callers fall back to the documented order-level path
 * (`findTicketOrderByPaymentIntent` + `revokeTicketOrder` /
 * `resolveTicketOrderDispute`) instead of dead-lettering a refund/dispute for
 * an early-sale order. A session carrying ANY v28 binding field is a v28+
 * session — partial binding is a defect and still throws.
 */
export function readVerifiedTicketCheckoutEvidence(input: Readonly<{
  eventLivemode: boolean;
  paymentIntentId: string;
  session: unknown;
}>): VerifiedTicketCheckoutEvidence | null {
  if (!isRecord(input.session)) return null;
  const metadata = isRecord(input.session.metadata) ? input.session.metadata : {};
  if (metadata.flow !== "ticket_calendar") return null;
  if (
    metadata.ticket_checkout_action_id === undefined
    && metadata.ticket_event_session_id === undefined
    && metadata.ticket_check_in_mode === undefined
  ) {
    return null;
  }

  const sessionId = readString(input.session.id);
  const clientReferenceId = readString(input.session.client_reference_id);
  const metadataOrderId = readString(metadata.ticket_order_id);
  const checkoutActionId = readString(metadata.ticket_checkout_action_id);
  const eventSessionId = readString(metadata.ticket_event_session_id);
  const checkInMode = readString(metadata.ticket_check_in_mode);
  const sessionPaymentIntentId = readProviderId(input.session.payment_intent);
  const expiresAtSeconds = input.session.expires_at;
  const livemode = input.session.livemode;

  if (
    !sessionId
    || !CHECKOUT_SESSION_ID_PATTERN.test(sessionId)
    || !clientReferenceId
    || !UUID_PATTERN.test(clientReferenceId)
    || metadataOrderId !== clientReferenceId
    || !checkoutActionId
    || !UUID_PATTERN.test(checkoutActionId)
    || !eventSessionId
    || !UUID_PATTERN.test(eventSessionId)
    || (checkInMode !== "legacy_qr" && checkInMode !== "wallet_swipe")
    || !PAYMENT_INTENT_ID_PATTERN.test(input.paymentIntentId)
    || sessionPaymentIntentId !== input.paymentIntentId
    || livemode !== input.eventLivemode
    || !Number.isSafeInteger(expiresAtSeconds)
    || (expiresAtSeconds as number) < 1
  ) {
    throw new Error("ticket_checkout_provider_evidence_invalid");
  }

  const providerExpiresAt = new Date((expiresAtSeconds as number) * 1_000).toISOString();
  return Object.freeze({
    ticketOrderId: clientReferenceId,
    checkoutActionId,
    eventSessionId,
    checkInMode,
    checkoutSessionId: sessionId,
    clientReferenceId,
    paymentIntentId: input.paymentIntentId,
    providerFlow: "ticket_calendar",
    providerResponseHash: createTicketCheckoutProviderResponseHash({
      checkoutSessionId: sessionId,
      expiresAt: providerExpiresAt,
      checkoutActionId,
      eventSessionId,
      checkInMode,
    }),
    providerExpiresAt,
  });
}

function readProviderId(value: unknown) {
  if (typeof value === "string") return value;
  return isRecord(value) ? readString(value.id) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
