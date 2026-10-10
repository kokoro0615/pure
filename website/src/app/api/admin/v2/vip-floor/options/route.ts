import { NextResponse } from "next/server";

import {
  readBusinessDate,
  VipFloorContractError,
} from "@/lib/vipFloorV2Contract";
import {
  createInvalidCommandResponse,
  requireVipFloorV2Read,
} from "@/lib/server/vipFloorV2";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireVipFloorV2Read(request);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.actor.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);

    if (
      [...url.searchParams.keys()].some((key) => key !== "businessDate") ||
      url.searchParams.getAll("businessDate").length !== 1
    ) {
      throw new VipFloorContractError("Invalid query", "businessDate");
    }

    const businessDate = readBusinessDate(url.searchParams.get("businessDate"));
    const supabase = createSupabaseAdminClient();
    const [
      eventDayResult,
      offeringsResult,
      offeringRequirementsResult,
      resourceGroupMembersResult,
    ] = await Promise.all([
      supabase
        .from("event_days")
        .select(
          "id,business_date,sales_open_at,sales_close_at,operating_status,closed_reason",
        )
        .eq("business_date", businessDate)
        .maybeSingle(),
      supabase
        .from("booking_offerings")
        .select("id,name,min_guests,max_guests,min_spend_yen")
        .eq("active", true)
        .order("min_spend_yen", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("offering_resource_requirements")
        .select("booking_offering_id,seat_resource_id,resource_group_id"),
      supabase
        .from("resource_group_members")
        .select("resource_group_id,seat_resource_id"),
    ]);

    if (
      eventDayResult.error ||
      offeringsResult.error ||
      offeringRequirementsResult.error ||
      resourceGroupMembersResult.error
    ) {
      return NextResponse.json(
        { ok: false, error: "vip_floor_options_read_failed" },
        { status: 500 },
      );
    }

    if (!eventDayResult.data) {
      return NextResponse.json(
        { ok: false, error: "event_day_not_found" },
        { status: 404 },
      );
    }

    const closedDayState =
      eventDayResult.data.operating_status === "closed"
        ? {
            state: "closed" as const,
            businessDate,
            reason: eventDayResult.data.closed_reason,
          }
        : null;

    const groupTableIds = new Map<string, Set<string>>();

    for (const member of resourceGroupMembersResult.data ?? []) {
      const tableIds =
        groupTableIds.get(member.resource_group_id) ?? new Set<string>();
      tableIds.add(member.seat_resource_id);
      groupTableIds.set(member.resource_group_id, tableIds);
    }

    const offeringTableIds = new Map<string, Set<string>>();

    for (const requirement of offeringRequirementsResult.data ?? []) {
      const tableIds =
        offeringTableIds.get(requirement.booking_offering_id) ??
        new Set<string>();
      if (requirement.seat_resource_id) {
        tableIds.add(requirement.seat_resource_id);
      }
      if (requirement.resource_group_id) {
        for (const tableId of groupTableIds.get(
          requirement.resource_group_id,
        ) ?? []) {
          tableIds.add(tableId);
        }
      }
      offeringTableIds.set(requirement.booking_offering_id, tableIds);
    }

    return NextResponse.json({
      ok: true,
      businessDay: {
        id: eventDayResult.data.id,
        businessDate: eventDayResult.data.business_date,
        operatingStartAt: eventDayResult.data.sales_open_at,
        operatingEndAt: eventDayResult.data.sales_close_at,
        operatingStatus: eventDayResult.data.operating_status,
      },
      ...(closedDayState ? { dayState: closedDayState } : {}),
      offerings: (offeringsResult.data ?? []).map((offering) => ({
        id: offering.id,
        name: offering.name,
        minGuests: offering.min_guests,
        maxGuests: offering.max_guests,
        minSpendYen: offering.min_spend_yen,
        compatibleTableIds: offeringTableIds.has(offering.id)
          ? [...(offeringTableIds.get(offering.id) ?? [])].sort()
          : null,
      })),
    });
  } catch (error) {
    return createInvalidCommandResponse(
      error instanceof VipFloorContractError ? error.field : undefined,
    );
  }
}
