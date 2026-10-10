import { NextResponse } from "next/server";

import { readBusinessDate, VipFloorContractError } from "@/lib/vipFloorV2Contract";
import { decryptCustomerProfileValue } from "@/lib/server/customerProfileCrypto";
import {
  createInvalidCommandResponse,
  requireVipFloorV2Read,
} from "@/lib/server/vipFloorV2";
import {
  parseCreateWaitlistCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireVipFloorV2Read(request);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "owner") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some((key) => key !== "businessDate")
      || url.searchParams.getAll("businessDate").length !== 1
    ) {
      throw new VipFloorContractError("Invalid query", "businessDate");
    }
    const businessDate = readBusinessDate(url.searchParams.get("businessDate"));
    const supabase = createSupabaseAdminClient();
    const { data: eventDay, error: dayError } = await supabase
      .from("event_days")
      .select("id")
      .eq("business_date", businessDate)
      .maybeSingle();
    if (dayError) {
      return NextResponse.json({ ok: false, error: "waitlist_read_failed" }, { status: 500 });
    }
    if (!eventDay) {
      return NextResponse.json({ ok: true, businessDate, entries: [] });
    }

    const { data, error } = await supabase
      .from("vip_waitlist_entries")
      .select(
        "id,event_day_id,guest_count,guest_label_ciphertext,email_ciphertext,status,called_at,call_expires_at,seated_reservation_id,version,created_at,updated_at",
      )
      .eq("event_day_id", eventDay.id)
      .order("created_at", { ascending: true });
    if (error) {
      return NextResponse.json({ ok: false, error: "waitlist_read_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      businessDate,
      entries: (data ?? []).map((entry) => ({
        id: entry.id,
        eventDayId: entry.event_day_id,
        guestCount: entry.guest_count,
        guestLabel: entry.guest_label_ciphertext
          ? decryptCustomerProfileValue(entry.guest_label_ciphertext)
          : null,
        email: entry.email_ciphertext
          ? decryptCustomerProfileValue(entry.email_ciphertext)
          : null,
        status: entry.status === "called"
          && entry.call_expires_at
          && Date.parse(entry.call_expires_at) <= Date.now()
          ? "expired"
          : entry.status,
        storedStatus: entry.status,
        calledAt: entry.called_at,
        callExpiresAt: entry.call_expires_at,
        seatedReservationId: entry.seated_reservation_id,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      })),
    });
  } catch (error) {
    return createInvalidCommandResponse(
      error instanceof VipFloorContractError ? error.field : undefined,
    );
  }
}

export async function POST(request: Request) {
  return runAdminRpcActionV2(request, {
    rpcName: "create_admin_waitlist_entry_v11",
    action: "waitlist.created",
    parse: parseCreateWaitlistCommand,
  });
}
