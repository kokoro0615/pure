import {
  requireTicketManagerCapability,
  requireTicketManagerOwner,
  ticketManagerJson,
} from "@/lib/server/tickets/ticketManagerHttp";
import { readRuntimeEnvironment } from "@/lib/server/runtimeEnvironment";
import { ticketManagerFailure } from "@/lib/server/tickets/ticketManagerOperations";
import { readBoundedJsonObject } from "@/lib/server/tickets/ticketWalletHttp";
import {
  listTicketCheckoutReviewQueue,
  resolveTicketCheckoutReview,
} from "@/lib/server/tickets/ticketCheckoutReviewResolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReviewDecision = "requeue" | "acknowledge" | "fulfill" | "escalate";

function readEnvironment() {
  return readRuntimeEnvironment();
}

export async function GET(request: Request) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  const gate = requireTicketManagerCapability("manager");
  if (!gate.ok) return gate.response;
  try {
    const items = await listTicketCheckoutReviewQueue(readEnvironment());
    return ticketManagerJson({ ok: true, items });
  } catch {
    return ticketManagerJson(
      ticketManagerFailure("operation_failed"), 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  const gate = requireTicketManagerCapability("manager");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonObject(request, 8_192);
  } catch {
    return ticketManagerJson(ticketManagerFailure("invalid_request"), 400);
  }
  const allowed = new Set([
    "checkoutActionId",
    "decision",
    "reason",
    "idempotencyKey",
    "providerSessionId",
    "expiresAt",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return ticketManagerJson(ticketManagerFailure("invalid_request"), 400);
  }
  const decision = body.decision;
  const idempotencyKey = body.idempotencyKey;
  const providerSessionId = body.providerSessionId;
  const expiresAt = body.expiresAt;
  if (
    typeof body.checkoutActionId !== "string"
    || (decision !== "requeue" && decision !== "acknowledge"
      && decision !== "fulfill" && decision !== "escalate")
    || typeof body.reason !== "string"
    || typeof idempotencyKey !== "string"
    || !/^[A-Za-z0-9:_-]{8,200}$/u.test(idempotencyKey)
    // An operator may supply the provider Session a fulfill decision should
    // bind when none was recorded (e.g. provider_facts_mismatch on the
    // recorded one). It is re-fetched and re-verified before binding — the
    // field is a pointer, never trusted facts.
    || (providerSessionId !== undefined
      && (decision !== "fulfill"
        || typeof providerSessionId !== "string"
        || !/^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u.test(providerSessionId)))
    // Optional operator-asserted expiry: must be an ISO timestamp the
    // re-fetched Session can be checked against, never the bound value.
    || (expiresAt !== undefined
      && (decision !== "fulfill"
        || typeof expiresAt !== "string"
        || !Number.isFinite(Date.parse(expiresAt))))
  ) {
    return ticketManagerJson(ticketManagerFailure("invalid_request"), 400);
  }

  try {
    const result = await resolveTicketCheckoutReview({
      actorAdminId: auth.actor.adminId,
      idempotencyKey,
      checkoutActionId: body.checkoutActionId,
      decision: decision as ReviewDecision,
      reason: body.reason,
      providerSessionId: decision === "fulfill" ? providerSessionId as string | undefined : undefined,
      providerExpiresAt: decision === "fulfill" ? expiresAt as string | undefined : undefined,
    });
    if (result.ok) return ticketManagerJson(result);
    const status = result.error === "not_found" ? 404
      : result.error === "idempotency_conflict" ? 409
      : result.error === "provider_lookup_failed" ? 503
      : result.error === "rejected" || result.error === "provider_facts_mismatch"
        || result.error === "fulfill_rejected" || result.error === "provider_session_missing"
        || result.error === "review_state_changed" ? 409
      : 500;
    return ticketManagerJson(
      ticketManagerFailure(
        "operation_failed",
        null,
        `checkout_review_${result.error}${result.reason ? `:${result.reason}` : ""}`,
      ),
      status,
    );
  } catch {
    return ticketManagerJson(ticketManagerFailure("operation_failed"), 500);
  }
}
