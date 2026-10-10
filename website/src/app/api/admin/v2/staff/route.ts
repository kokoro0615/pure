import { NextResponse } from "next/server";

import { readBusinessDate, VipFloorContractError } from "@/lib/vipFloorV2Contract";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  createInvalidCommandResponse,
  requireVipFloorV2Read,
} from "@/lib/server/vipFloorV2";
import {
  parseCreateStaffMemberCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

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
    const eventDay = await supabase
      .from("event_days")
      .select("id")
      .eq("business_date", businessDate)
      .maybeSingle();
    if (eventDay.error) {
      return NextResponse.json({ ok: false, error: "staff_read_failed" }, { status: 500 });
    }
    if (!eventDay.data) {
      return NextResponse.json({ ok: false, error: "event_day_not_found" }, { status: 404 });
    }

    const [staff, assignments] = await Promise.all([
      supabase
        .from("vip_staff_members")
        .select("id,display_name,active,version,created_at,updated_at")
        .order("active", { ascending: false })
        .order("display_name", { ascending: true }),
      supabase
        .from("vip_table_staff_assignments")
        .select("id,seat_resource_id,staff_member_id,version,created_at,updated_at")
        .eq("event_day_id", eventDay.data.id)
        .is("released_at", null)
        .order("created_at", { ascending: true }),
    ]);
    if (staff.error || assignments.error) {
      return NextResponse.json({ ok: false, error: "staff_read_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      eventDayId: eventDay.data.id,
      staffMembers: (staff.data ?? []).map((member) => ({
        id: member.id,
        displayName: member.display_name,
        active: member.active,
        version: member.version,
        createdAt: member.created_at,
        updatedAt: member.updated_at,
      })),
      tableAssignments: (assignments.data ?? []).map((assignment) => ({
        id: assignment.id,
        tableId: assignment.seat_resource_id,
        staffMemberId: assignment.staff_member_id,
        version: assignment.version,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
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
    rpcName: "create_admin_vip_staff_member_v12",
    action: "staff_member.created",
    parse: parseCreateStaffMemberCommand,
  });
}
