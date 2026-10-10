import "server-only";

import { packCustomerProfileValueForPostgres } from "../customerProfileCrypto";
import { createSupabaseAdminClient } from "../supabaseAdmin";
import {
  generateAdmissionCodes,
  generateTicketOrderCode,
  hashPurchaserEmail,
} from "./admissionCodes";

/**
 * The operational interface that ticket sales were fail-closed waiting for.
 *
 * Every state transition lives in a SECURITY DEFINER function so the guarantees
 * are enforced by the database rather than by the caller remembering to:
 *   - one settled payment produces exactly one order;
 *   - a replayed provider event issues no extra admissions;
 *   - an admission is spent once.
 *
 * Behaviour proof: supabase/tests/ticket_fulfillment_v23.sql,
 * supabase/tests/ticket_revocation_v24.sql, and ticket_operations_v25.sql.
 */
export const TICKET_FULFILLMENT_CONTRACT = "ghost.tickets.v30";

export type TicketOrderItem = {
  ticketTypeId: string;
  label: string;
  quantity: number;
  unitPriceYen: number;
};

export type CreateTicketOrderInput = {
  eventId: string;
  eventSlug: string;
  eventDate: string;
  eventTitle: string;
  environment: "test" | "live";
  stripeAccountId: string | null;
  amountYen: number;
  items: TicketOrderItem[];
};

export type CreatedTicketOrder = {
  orderId: string;
  publicCode: string;
};

export async function createPendingTicketOrder(
  input: CreateTicketOrderInput,
): Promise<CreatedTicketOrder> {
  const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const supabase = createSupabaseAdminClient();

  // The public code is random, so a collision is possible in principle and
  // fatal in practice (the unique index rejects it). Retry a bounded number of
  // times rather than failing a paying customer's checkout.
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.rpc("create_ticket_order_v23", {
      p_public_code: generateTicketOrderCode(),
      p_event_id: input.eventId,
      p_event_slug: input.eventSlug,
      p_event_date: input.eventDate,
      p_event_title: input.eventTitle,
      p_environment: input.environment,
      p_stripe_account_id: input.stripeAccountId,
      p_amount_yen: input.amountYen,
      p_total_quantity: totalQuantity,
      p_items_json: input.items,
    });

    if (error) {
      lastError = error.code === "23505" ? "public_code_collision" : error.message;
      if (error.code === "23505") continue;
      throw new Error("ticket_order_create_failed");
    }

    const result = data as { action?: string; orderId?: string; publicCode?: string; reason?: string } | null;
    if (result?.action !== "created" || !result.orderId || !result.publicCode) {
      throw new Error(`ticket_order_create_rejected:${result?.reason ?? "unknown"}`);
    }
    return { orderId: result.orderId, publicCode: result.publicCode };
  }

  throw new Error(`ticket_order_create_failed:${lastError ?? "retries_exhausted"}`);
}

export type TicketAdmission = {
  serial: number;
  ticketTypeId: string;
  ticketTypeLabel: string;
  admissionCode?: string;
  status: string;
  admittedAt: string | null;
};

export type FulfillTicketOrderInput = {
  providerPaidAt?: string | null;
  orderId: string;
  environment: "test" | "live";
  stripeAccountId: string | null;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  amountYen: number | null;
  purchaserEmail: string | null;
  totalQuantity: number;
};

export type FulfillTicketOrderResult =
  | {
    ok: true;
    action: "fulfilled" | "reused";
    orderId: string;
    publicCode: string;
    checkInMode: "legacy_qr" | "wallet_swipe";
    admissions: TicketAdmission[];
    purchaserEmailStored: boolean;
  }
  | { ok: false; action: "not_found" | "rejected"; reason?: string };

export async function fulfillTicketOrder(
  input: FulfillTicketOrderInput,
): Promise<FulfillTicketOrderResult> {
  let purchaserEmailCiphertext: string | null = null;
  if (input.purchaserEmail) {
    try {
      purchaserEmailCiphertext = packCustomerProfileValueForPostgres(
        input.purchaserEmail.trim().toLowerCase(),
      );
    } catch {
      // Payment fulfilment must survive an email-key outage. Readiness prevents
      // new checkout while the key is absent; an already-paid order is still
      // issued, and the missing delivery channel is made explicit in the result.
      purchaserEmailCiphertext = null;
    }
  }

  const { data, error } = await createSupabaseAdminClient().rpc("fulfill_ticket_order_v35", {
    p_provider_paid_at: input.providerPaidAt ?? null,
    p_order_id: input.orderId,
    p_environment: input.environment,
    p_stripe_account_id: input.stripeAccountId,
    p_payment_intent_id: input.paymentIntentId,
    p_checkout_session_id: input.checkoutSessionId,
    p_amount_yen: input.amountYen,
    p_purchaser_email_hash: input.purchaserEmail ? hashPurchaserEmail(input.purchaserEmail) : null,
    p_purchaser_email_ciphertext: purchaserEmailCiphertext,
    // Fresh codes every call. A replay's codes are discarded by the unique
    // (order, serial) key and the customer keeps the ticket already issued.
    p_admission_codes: generateAdmissionCodes(input.totalQuantity),
  });

  if (error) throw new Error("ticket_order_fulfill_failed");

  const result = data as {
    action?: string;
    reason?: string;
    orderId?: string;
    publicCode?: string;
    checkInMode?: "legacy_qr" | "wallet_swipe";
    admissions?: TicketAdmission[];
  } | null;

  if (result?.action === "fulfilled" || result?.action === "reused") {
    if (result.checkInMode !== "legacy_qr" && result.checkInMode !== "wallet_swipe") {
      throw new Error("ticket_order_fulfill_mode_missing");
    }
    if (
      result.checkInMode === "wallet_swipe"
      && (result.admissions ?? []).some((admission) => "admissionCode" in admission)
    ) {
      throw new Error("ticket_order_fulfill_wallet_secret_leak");
    }
    return {
      ok: true,
      action: result.action,
      orderId: result.orderId as string,
      publicCode: result.publicCode as string,
      checkInMode: result.checkInMode,
      admissions: result.admissions ?? [],
      purchaserEmailStored: Boolean(purchaserEmailCiphertext),
    };
  }

  return {
    ok: false,
    action: result?.action === "not_found" ? "not_found" : "rejected",
    reason: result?.reason,
  };
}

export type AdmitTicketResult = {
  action: "admitted" | "already_admitted" | "rejected" | "not_found";
  reason?: string;
  publicCode?: string;
  serial?: number;
  totalQuantity?: number;
  ticketTypeLabel?: string;
  eventDate?: string;
  eventTitle?: string;
  admittedAt?: string;
};

export async function admitTicket(
  admissionCode: string,
  actorAdminId: string | null,
  expectedEventSessionId: string,
  expectedEnvironment: "test" | "live",
): Promise<AdmitTicketResult> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "admit_ticket_at_door_v27",
    {
      p_admission_code: admissionCode,
      p_actor_admin_id: actorAdminId,
      p_expected_event_session_id: expectedEventSessionId,
      p_expected_environment: expectedEnvironment,
    },
  );

  if (error) throw new Error("ticket_admit_failed");
  return (data as AdmitTicketResult) ?? { action: "rejected", reason: "empty_response" };
}

type TicketOrderViewBase = {
  id: string;
  publicCode: string;
  status: string;
  eventId: string;
  eventDate: string;
  eventTitle: string;
  amountYen: number;
  totalQuantity: number;
  items: TicketOrderItem[];
};

export type TicketOrderView =
  | (TicketOrderViewBase & {
    checkInMode: "legacy_qr";
    admissions: Array<TicketAdmission & { admissionCode: string }>;
  })
  | (TicketOrderViewBase & {
    checkInMode: "wallet_swipe";
    admissions: [];
  });

/** Read one order for the completion screen. Never exposes purchaser contact. */
export async function readTicketOrder(orderId: string): Promise<TicketOrderView | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ticket_orders")
    .select("id,public_code,status,event_id,event_date,event_title,amount_yen,total_quantity,items_json,check_in_mode")
    .eq("id", orderId)
    .maybeSingle();

  if (
    error
    || !data
    || (data.check_in_mode !== "legacy_qr" && data.check_in_mode !== "wallet_swipe")
  ) return null;

  const base = {
    id: data.id as string,
    publicCode: data.public_code as string,
    status: data.status as string,
    eventId: data.event_id as string,
    eventDate: data.event_date as string,
    eventTitle: data.event_title as string,
    amountYen: data.amount_yen as number,
    totalQuantity: data.total_quantity as number,
    items: (data.items_json as TicketOrderItem[]) ?? [],
  };

  // The mode decision is made before the admission table is queried. Wallet
  // orders must never bring a bearer admission secret across the server boundary.
  if (data.check_in_mode === "wallet_swipe") {
    return { ...base, checkInMode: "wallet_swipe", admissions: [] };
  }

  const { data: admissions } = await supabase
    .from("ticket_admissions")
    .select("serial,ticket_type_id,ticket_type_label,admission_code,status,admitted_at")
    .eq("ticket_order_id", orderId)
    .order("serial", { ascending: true });

  return {
    ...base,
    checkInMode: "legacy_qr",
    admissions: (admissions ?? []).map((row) => ({
      serial: row.serial as number,
      ticketTypeId: row.ticket_type_id as string,
      ticketTypeLabel: row.ticket_type_label as string,
      admissionCode: row.admission_code as string,
      status: row.status as string,
      admittedAt: (row.admitted_at as string | null) ?? null,
    })),
  };
}

/** Resolve the order a provider payment belongs to, when metadata is unavailable. */
export async function findTicketOrderByPaymentIntent(
  environment: "test" | "live",
  paymentIntentId: string,
): Promise<{ id: string; totalQuantity: number; amountYen: number } | null> {
  const { data } = await createSupabaseAdminClient()
    .from("ticket_orders")
    .select("id,total_quantity,amount_yen")
    .eq("environment", environment)
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();

  return data
    ? {
      id: data.id as string,
      totalQuantity: data.total_quantity as number,
      amountYen: data.amount_yen as number,
    }
    : null;
}

export type RevokeTicketOrderResult = {
  action: "revoked" | "held" | "reused" | "rejected" | "not_found";
  reason?: string;
  orderId?: string;
  publicCode?: string;
  orderStatus?: string;
  voided?: number;
  alreadyVoid?: number;
  alreadyAdmitted?: number;
};

/**
 * Stop the admissions on an order from opening the door.
 *
 * Used when the money goes away — a full refund or an opened dispute — and
 * available to an operator for a lost or stolen code. Admissions already spent
 * are left alone by the RPC: the door's record of who came in is not rewritten.
 */
export async function revokeTicketOrder(input: {
  orderId: string;
  environment: "test" | "live";
  reason: string;
  setOrderRefunded: boolean;
  actorAdminId: string | null;
}): Promise<RevokeTicketOrderResult> {
  const { data, error } = await createSupabaseAdminClient().rpc("revoke_ticket_order_v24", {
    p_order_id: input.orderId,
    p_environment: input.environment,
    p_reason: input.reason,
    p_set_order_refunded: input.setOrderRefunded,
    p_actor_admin_id: input.actorAdminId,
  });

  if (error) throw new Error("ticket_order_revoke_failed");
  return (data as RevokeTicketOrderResult) ?? { action: "rejected", reason: "empty_response" };
}

export type ApplyTicketRefundResult = {
  action:
    | "applied"
    | "review_required"
    | "conflict_review"
    | "reused"
    | "rejected"
    | "not_found";
  orderId?: string;
  resolutionStatus?: "applied" | "review_required" | "conflict_review";
  reason?: string;
  voided?: number;
};

export async function applyTicketRefund(input: {
  environment: "test" | "live";
  stripeAccountId: string | null;
  refundId: string;
  paymentIntentId: string;
  amountYen: number;
  providerStatus: "succeeded" | "failed" | "canceled";
  admissionSerials: number[];
  providerReason: string;
  inputValid: boolean;
  validationReason: string | null;
}): Promise<ApplyTicketRefundResult> {
  const { data, error } = await createSupabaseAdminClient().rpc("apply_ticket_refund_v26", {
    p_environment: input.environment,
    p_stripe_account_id: input.stripeAccountId,
    p_stripe_refund_id: input.refundId,
    p_payment_intent_id: input.paymentIntentId,
    p_amount_yen: input.amountYen,
    p_provider_status: input.providerStatus,
    p_admission_serials: input.admissionSerials,
    p_provider_reason: input.providerReason,
    p_input_valid: input.inputValid,
    p_validation_reason: input.validationReason,
  });
  if (error) throw new Error("ticket_refund_apply_failed");
  return (data as ApplyTicketRefundResult) ?? { action: "rejected", reason: "empty_response" };
}

export type TicketCheckoutProviderEvidenceInput = {
  ticketOrderId: string;
  checkoutActionId: string;
  eventSessionId: string;
  checkInMode: "legacy_qr" | "wallet_swipe";
  environment: "test" | "live";
  stripeAccountId: string | null;
  checkoutSessionId: string;
  clientReferenceId: string;
  paymentIntentId: string;
  providerFlow: "ticket_calendar";
  providerResponseHash: string;
  providerExpiresAt: string;
};

export async function applyVerifiedTicketCheckoutRefund(
  input: TicketCheckoutProviderEvidenceInput & {
    refundId: string;
    amountYen: number;
    providerStatus: "succeeded" | "failed" | "canceled";
    admissionSerials: number[];
    providerReason: string;
    inputValid: boolean;
    validationReason: string | null;
  },
): Promise<(ApplyTicketRefundResult | { action: "not_ticket"; reason?: string }) & {
  checkoutActionId?: string;
}> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "apply_ticket_checkout_refund_v28",
    {
      p_ticket_order_id: input.ticketOrderId,
      p_provider_checkout_action_id: input.checkoutActionId,
      p_provider_event_session_id: input.eventSessionId,
      p_provider_check_in_mode: input.checkInMode,
      p_environment: input.environment,
      p_stripe_account_id: input.stripeAccountId,
      p_checkout_session_id: input.checkoutSessionId,
      p_client_reference_id: input.clientReferenceId,
      p_payment_intent_id: input.paymentIntentId,
      p_provider_flow: input.providerFlow,
      p_provider_response_hash: input.providerResponseHash,
      p_provider_expires_at: input.providerExpiresAt,
      p_stripe_refund_id: input.refundId,
      p_amount_yen: input.amountYen,
      p_provider_status: input.providerStatus,
      p_admission_serials: input.admissionSerials,
      p_provider_reason: input.providerReason,
      p_input_valid: input.inputValid,
      p_validation_reason: input.validationReason,
    },
  );
  if (error) throw new Error("ticket_checkout_refund_apply_failed");
  return (data as (ApplyTicketRefundResult | { action: "not_ticket"; reason?: string })
    & { checkoutActionId?: string })
    ?? { action: "rejected", reason: "empty_response" };
}

export async function revokeVerifiedTicketCheckoutPayment(
  input: TicketCheckoutProviderEvidenceInput & {
    revocationKind: "charge_refunded" | "dispute";
    reason: string;
  },
): Promise<(RevokeTicketOrderResult | { action: "not_ticket"; reason?: string }) & {
  checkoutActionId?: string;
  revocationKind?: string;
}> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "revoke_ticket_checkout_payment_v28",
    {
      p_ticket_order_id: input.ticketOrderId,
      p_provider_checkout_action_id: input.checkoutActionId,
      p_provider_event_session_id: input.eventSessionId,
      p_provider_check_in_mode: input.checkInMode,
      p_environment: input.environment,
      p_stripe_account_id: input.stripeAccountId,
      p_checkout_session_id: input.checkoutSessionId,
      p_client_reference_id: input.clientReferenceId,
      p_payment_intent_id: input.paymentIntentId,
      p_provider_flow: input.providerFlow,
      p_provider_response_hash: input.providerResponseHash,
      p_provider_expires_at: input.providerExpiresAt,
      p_revocation_kind: input.revocationKind,
      p_reason: input.reason,
    },
  );
  if (error) throw new Error("ticket_checkout_payment_revoke_failed");
  return (data as (RevokeTicketOrderResult | { action: "not_ticket"; reason?: string }) & {
    checkoutActionId?: string;
    revocationKind?: string;
  }) ?? { action: "rejected", reason: "empty_response" };
}

export async function revokeTicketAdmissions(input: {
  orderId: string;
  environment: "test" | "live";
  admissionSerials: number[];
  reason: string;
  actorAdminId: string | null;
}): Promise<RevokeTicketOrderResult> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "revoke_ticket_admissions_v25",
    {
      p_order_id: input.orderId,
      p_environment: input.environment,
      p_admission_serials: input.admissionSerials,
      p_reason: input.reason,
      p_actor_admin_id: input.actorAdminId,
    },
  );
  if (error) throw new Error("ticket_admissions_revoke_failed");
  return (data as RevokeTicketOrderResult) ?? { action: "rejected", reason: "empty_response" };
}

/**
 * Expire orders whose customer opened Checkout and never paid.
 *
 * Without this the pending rows accumulate forever and every "orders today"
 * readout counts abandoned carts as sales. The RPC floors the window at 30
 * minutes so a mis-set caller cannot expire an order that is still being paid.
 */
export async function expireStaleTicketOrders(olderThanMinutes: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("expire_stale_ticket_orders_v23", {
    p_older_than_minutes: Math.trunc(olderThanMinutes),
  });

  if (error) throw new Error("ticket_order_expire_failed");
  return (data as { action?: string; count?: number } | null) ?? { action: "expired", count: 0 };
}
