import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/server/adminAuth";
import { isFeatureEnabled } from "@/lib/server/featureFlags";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  createVipFloorShadowRequestContext,
  scheduleAdminVipFloorShadowComparison,
} from "@/lib/server/vipFloorShadowRuntime";

export const runtime = "nodejs";

type ReservationRow = {
  id: string;
  public_code: string;
  booking_slot_id: string;
  booking_offering_id: string;
  guest_count: number;
  status: string;
  intake_channel: string | null;
  guest_label: string | null;
  operator_note: string | null;
  vipapp_service_status: string | null;
  vipapp_arrived_at: string | null;
  hold_expires_at: string | null;
  admin_hold_expires_at: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  seat_due_at: string | null;
  seat_extended_until_at: string | null;
  seat_extension_minutes: number;
  created_at: string;
  updated_at: string;
};

type ReservationResourceRow = {
  reservation_id: string;
  seat_resource_id: string;
  lock_status: string;
  hold_expires_at: string | null;
  admin_hold_expires_at: string | null;
  confirmed_at: string | null;
};

type PaymentRow = {
  reservation_id: string;
  status: string;
  type: string;
  amount_yen: number;
  environment: string;
  stripe_account_key: string;
  payment_method_id: string | null;
  stripe_payment_method_id: string | null;
  provider_object_type: string | null;
  provider_object_id: string | null;
  updated_at: string;
};

type WebhookEventRow = {
  environment: string;
  stripe_account_key: string;
  provider_object_type: string | null;
  provider_object_id: string | null;
  processing_status: string;
  updated_at: string;
};

type StripeObjectStateRow = {
  environment: string;
  stripe_account_key: string;
  object_type: string;
  object_id: string;
  stripe_status: string;
  updated_at: string;
};

type PaymentEvidence = {
  status: string;
  type: string;
  amountYen: number;
  environment: string;
  providerObjectType: string | null;
  providerObjectId: string | null;
  hasStripePaymentMethodId: boolean;
  paymentMethodSaved: boolean;
  webhookProcessingStatus: string | null;
  stripeObjectStatus: string | null;
  updatedAt: string;
} | null;

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  // This legacy compatibility reader returns guest labels and operator notes
  // unmasked. The v2 board masks them for every role below owner, so the
  // legacy path is owner-only rather than a way around that projection.
  if (auth.actor.role !== "owner") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date");
  const eventDay = await resolveEventDay(supabase, requestedDate);

  if (!eventDay) {
    return NextResponse.json({
      ok: true,
      businessDate: requestedDate ?? null,
      slots: [],
      offerings: [],
      seats: [],
      reservations: [],
      totals: emptyTotals(),
      operations: operationState(),
    });
  }

  const slotIds = await readSlotIds(supabase, eventDay.id);
  const [
    slotsResult,
    offeringsResult,
    resourcesResult,
    reservationsResult,
  ] = await Promise.all([
    supabase
      .from("booking_slots")
      .select("id, public_slot_id, start_at, end_at, active, admin_only")
      .eq("event_day_id", eventDay.id)
      .order("start_at", { ascending: true }),
    supabase
      .from("booking_offerings")
      .select("id, public_offering_id, name, min_guests, max_guests, min_spend_yen, active")
      .order("min_spend_yen", { ascending: false }),
    supabase
      .from("seat_resources")
      .select("id, public_resource_code, name, capacity_min, capacity_max, active")
      .eq("active", true)
      .order("name", { ascending: true }),
    slotIds.length > 0
      ? supabase
          .from("reservations")
          .select(
            "id, public_code, booking_slot_id, booking_offering_id, guest_count, status, intake_channel, guest_label, operator_note, vipapp_service_status, vipapp_arrived_at, hold_expires_at, admin_hold_expires_at, confirmed_at, checked_in_at, seat_due_at, seat_extended_until_at, seat_extension_minutes, created_at, updated_at",
          )
          .in("booking_slot_id", slotIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (slotsResult.error) throw new Error(slotsResult.error.message);
  if (offeringsResult.error) throw new Error(offeringsResult.error.message);
  if (resourcesResult.error) throw new Error(resourcesResult.error.message);
  if (reservationsResult.error) throw new Error(reservationsResult.error.message);

  const reservations = (reservationsResult.data ?? []) as ReservationRow[];
  const reservationIds = reservations.map((reservation) => reservation.id);
  const reservationResources =
    reservationIds.length > 0
      ? await readReservationResources(supabase, reservationIds)
      : [];
  const paymentEvidenceByReservationId =
    reservationIds.length > 0
      ? await readPaymentEvidenceByReservation(supabase, reservationIds)
      : new Map<string, PaymentEvidence>();

  const slots = slotsResult.data ?? [];
  const offerings = offeringsResult.data ?? [];
  const resources = resourcesResult.data ?? [];
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const resourcesByReservationId = groupByReservation(reservationResources);

  const reservationSummaries = reservations.map((reservation) => {
    const lockedResources = resourcesByReservationId.get(reservation.id) ?? [];
    const slot = slotById.get(reservation.booking_slot_id);
    const offering = offeringById.get(reservation.booking_offering_id);
    const payment = paymentEvidenceByReservationId.get(reservation.id) ?? null;
    const seatDeadline = reservation.seat_extended_until_at ?? reservation.seat_due_at;
    const seatOverdueMinutes =
      reservation.status === "checked_in" && seatDeadline
        ? Math.max(0, Math.floor((Date.now() - new Date(seatDeadline).getTime()) / 60_000))
        : 0;

    return {
      id: reservation.id,
      publicCode: reservation.public_code,
      status: reservation.status,
      sourceChannel: reservation.intake_channel ?? inferSourceChannel(reservation.status),
      guestLabel: reservation.guest_label,
      operatorNote: reservation.operator_note,
      serviceStatus: reservation.vipapp_service_status,
      arrivedAt: reservation.vipapp_arrived_at,
      payment,
      guestCount: reservation.guest_count,
      slot: slot
        ? {
            publicSlotId: slot.public_slot_id,
            startAt: slot.start_at,
            endAt: slot.end_at,
          }
        : null,
      offering: offering
        ? {
            publicOfferingId: offering.public_offering_id,
            name: offering.name,
            minSpendYen: offering.min_spend_yen,
          }
        : null,
      seats: lockedResources.map((lock) => {
        const resource = resourceById.get(lock.seat_resource_id);
        return {
          publicResourceCode: resource?.public_resource_code ?? null,
          name: resource?.name ?? null,
          lockStatus: lock.lock_status,
          holdExpiresAt: lock.hold_expires_at,
          adminHoldExpiresAt: lock.admin_hold_expires_at,
          confirmedAt: lock.confirmed_at,
        };
      }),
      holdExpiresAt: reservation.hold_expires_at,
      adminHoldExpiresAt: reservation.admin_hold_expires_at,
      confirmedAt: reservation.confirmed_at,
      checkedInAt: reservation.checked_in_at,
      seatDueAt: reservation.seat_due_at,
      seatExtendedUntilAt: reservation.seat_extended_until_at,
      seatExtensionMinutes: reservation.seat_extension_minutes,
      seatOverdue: reservation.status === "checked_in" && seatOverdueMinutes > 0,
      seatOverdueMinutes,
      createdAt: reservation.created_at,
      updatedAt: reservation.updated_at,
    };
  });

  const activeLocksByResourceId = new Map<string, ReservationResourceRow[]>();
  for (const lock of reservationResources) {
    if (!["held", "payment_grace_locked", "confirmed"].includes(lock.lock_status)) continue;
    const current = activeLocksByResourceId.get(lock.seat_resource_id) ?? [];
    current.push(lock);
    activeLocksByResourceId.set(lock.seat_resource_id, current);
  }

  const seats = resources.map((resource) => {
    const locks = activeLocksByResourceId.get(resource.id) ?? [];
    const relatedReservations = locks
      .map((lock) => reservationSummaries.find((reservation) => reservation.id === lock.reservation_id))
      .filter(Boolean);
    const primaryReservation = relatedReservations[0] ?? null;

    return {
      publicResourceCode: resource.public_resource_code,
      name: resource.name,
      capacityMin: resource.capacity_min,
      capacityMax: resource.capacity_max,
      active: resource.active,
      occupancy: primaryReservation ? primaryReservation.status : "available",
      reservation: primaryReservation
        ? {
            id: primaryReservation.id,
            publicCode: primaryReservation.publicCode,
            status: primaryReservation.status,
            sourceChannel: primaryReservation.sourceChannel,
            guestLabel: primaryReservation.guestLabel,
            guestCount: primaryReservation.guestCount,
            slot: primaryReservation.slot,
            offering: primaryReservation.offering,
            checkedInAt: primaryReservation.checkedInAt,
            seatDueAt: primaryReservation.seatDueAt,
            seatExtendedUntilAt: primaryReservation.seatExtendedUntilAt,
            seatExtensionMinutes: primaryReservation.seatExtensionMinutes,
            seatOverdue: primaryReservation.seatOverdue,
            seatOverdueMinutes: primaryReservation.seatOverdueMinutes,
            payment: primaryReservation.payment,
          }
        : null,
    };
  });

  const responsePayload = {
    ok: true,
    businessDate: eventDay.business_date,
    eventDay: {
      id: eventDay.id,
      businessDate: eventDay.business_date,
      salesOpenAt: eventDay.sales_open_at,
      salesCloseAt: eventDay.sales_close_at,
      venueTimezone: eventDay.venue_timezone,
    },
    slots: slots.map((slot) => ({
      publicSlotId: slot.public_slot_id,
      startAt: slot.start_at,
      endAt: slot.end_at,
      active: slot.active,
      adminOnly: slot.admin_only,
      reservationCount: reservations.filter((reservation) => reservation.booking_slot_id === slot.id).length,
    })),
    offerings: offerings.map((offering) => ({
      publicOfferingId: offering.public_offering_id,
      name: offering.name,
      minGuests: offering.min_guests,
      maxGuests: offering.max_guests,
      minSpendYen: offering.min_spend_yen,
      active: offering.active,
    })),
    seats,
    reservations: reservationSummaries,
    totals: summarize(reservationSummaries, seats),
    operations: operationState(),
  };

  scheduleAdminVipFloorShadowComparison({
    actorAdminId: auth.actor.adminId,
    businessDate: eventDay.business_date,
    requestContext: createVipFloorShadowRequestContext(request, "admin-board"),
    servedPayload: responsePayload,
  });

  return NextResponse.json(responsePayload);
}

function operationState() {
  return {
    adminMutationEnabled: isFeatureEnabled("FEATURE_ADMIN_MUTATION_ENABLED"),
    webhookProcessingEnabled: isFeatureEnabled("FEATURE_WEBHOOK_PROCESSING_ENABLED"),
    publicBookingEnabled: isFeatureEnabled("FEATURE_PUBLIC_BOOKING_ENABLED"),
  };
}

function inferSourceChannel(status: string) {
  if (status === "admin_hold" || status === "admin_hold_review") {
    return "admin_hold";
  }

  return "online";
}

async function resolveEventDay(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  requestedDate: string | null,
) {
  if (requestedDate) {
    const { data, error } = await supabase
      .from("event_days")
      .select("id, business_date, sales_open_at, sales_close_at, venue_timezone")
      .eq("business_date", requestedDate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data, error } = await supabase
    .from("event_days")
    .select("id, business_date, sales_open_at, sales_close_at, venue_timezone")
    .gte("business_date", today)
    .order("business_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function readSlotIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  eventDayId: string,
) {
  const { data, error } = await supabase
    .from("booking_slots")
    .select("id")
    .eq("event_day_id", eventDayId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((slot) => slot.id);
}

async function readReservationResources(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  reservationIds: string[],
) {
  const { data, error } = await supabase
    .from("reservation_resources")
    .select("reservation_id, seat_resource_id, lock_status, hold_expires_at, admin_hold_expires_at, confirmed_at")
    .in("reservation_id", reservationIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as ReservationResourceRow[];
}

async function readPaymentEvidenceByReservation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  reservationIds: string[],
) {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "reservation_id, status, type, amount_yen, environment, stripe_account_key, payment_method_id, stripe_payment_method_id, provider_object_type, provider_object_id, updated_at",
    )
    .in("reservation_id", reservationIds);

  if (error) throw new Error(error.message);

  const latestPaymentByReservationId = new Map<string, PaymentRow>();
  const providerObjectIds = new Set<string>();
  const payments = (data ?? []) as PaymentRow[];

  for (const payment of payments) {
    const current = latestPaymentByReservationId.get(payment.reservation_id);
    if (!current || new Date(payment.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      latestPaymentByReservationId.set(payment.reservation_id, payment);
    }
    if (payment.provider_object_id) {
      providerObjectIds.add(payment.provider_object_id);
    }
  }

  const [webhookEvents, stripeObjectStates] =
    providerObjectIds.size > 0
      ? await Promise.all([
          readWebhookEventsForProviderObjects(supabase, [...providerObjectIds]),
          readStripeObjectStatesForProviderObjects(supabase, [...providerObjectIds]),
        ])
      : [new Map<string, WebhookEventRow>(), new Map<string, StripeObjectStateRow>()];

  const evidenceByReservationId = new Map<string, PaymentEvidence>();

  for (const [reservationId, payment] of latestPaymentByReservationId) {
    const providerKey = payment.provider_object_id
      ? providerObjectKey(
          payment.environment,
          payment.stripe_account_key,
          payment.provider_object_type,
          payment.provider_object_id,
        )
      : null;
    const webhook = providerKey ? webhookEvents.get(providerKey) : null;
    const objectState = providerKey ? stripeObjectStates.get(providerKey) : null;

    evidenceByReservationId.set(reservationId, {
      status: payment.status,
      type: payment.type,
      amountYen: payment.amount_yen,
      environment: payment.environment,
      providerObjectType: payment.provider_object_type,
      providerObjectId: payment.provider_object_id,
      hasStripePaymentMethodId: Boolean(payment.stripe_payment_method_id),
      paymentMethodSaved: Boolean(payment.payment_method_id || payment.stripe_payment_method_id),
      webhookProcessingStatus: webhook?.processing_status ?? null,
      stripeObjectStatus: objectState?.stripe_status ?? null,
      updatedAt: payment.updated_at,
    });
  }

  return evidenceByReservationId;
}

async function readWebhookEventsForProviderObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  providerObjectIds: string[],
) {
  const { data, error } = await supabase
    .from("webhook_events")
    .select(
      "environment, stripe_account_key, provider_object_type, provider_object_id, processing_status, updated_at",
    )
    .in("provider_object_id", providerObjectIds);

  if (error) throw new Error(error.message);

  const latestByProviderObject = new Map<string, WebhookEventRow>();
  for (const row of (data ?? []) as WebhookEventRow[]) {
    if (!row.provider_object_id) continue;
    const key = providerObjectKey(
      row.environment,
      row.stripe_account_key,
      row.provider_object_type,
      row.provider_object_id,
    );
    const current = latestByProviderObject.get(key);
    if (!current || new Date(row.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      latestByProviderObject.set(key, row);
    }
  }

  return latestByProviderObject;
}

async function readStripeObjectStatesForProviderObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  providerObjectIds: string[],
) {
  const { data, error } = await supabase
    .from("stripe_object_states")
    .select("environment, stripe_account_key, object_type, object_id, stripe_status, updated_at")
    .in("object_id", providerObjectIds);

  if (error) throw new Error(error.message);

  const latestByProviderObject = new Map<string, StripeObjectStateRow>();
  for (const row of (data ?? []) as StripeObjectStateRow[]) {
    const key = providerObjectKey(row.environment, row.stripe_account_key, row.object_type, row.object_id);
    const current = latestByProviderObject.get(key);
    if (!current || new Date(row.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      latestByProviderObject.set(key, row);
    }
  }

  return latestByProviderObject;
}

function providerObjectKey(
  environment: string,
  stripeAccountKey: string,
  providerObjectType: string | null,
  providerObjectId: string,
) {
  return `${environment}:${stripeAccountKey}:${providerObjectType ?? "unknown"}:${providerObjectId}`;
}

function groupByReservation(rows: ReservationResourceRow[]) {
  const grouped = new Map<string, ReservationResourceRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.reservation_id) ?? [];
    current.push(row);
    grouped.set(row.reservation_id, current);
  }
  return grouped;
}

function summarize(
  reservations: Array<{ status: string }>,
  seats: Array<{ occupancy: string }>,
) {
  const totals = emptyTotals();
  totals.reservations = reservations.length;
  totals.seats = seats.length;
  totals.availableSeats = seats.filter((seat) => seat.occupancy === "available").length;
  totals.occupiedSeats = seats.length - totals.availableSeats;

  for (const reservation of reservations) {
    totals.byStatus[reservation.status] = (totals.byStatus[reservation.status] ?? 0) + 1;
  }

  return totals;
}

function emptyTotals() {
  return {
    reservations: 0,
    seats: 0,
    occupiedSeats: 0,
    availableSeats: 0,
    byStatus: {} as Record<string, number>,
  };
}
