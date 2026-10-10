import { NextResponse } from "next/server";

import {
  createVipFloorErrorResponse,
  requireVipFloorV2AdminSession,
} from "@/lib/server/vipFloorV2";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireVipFloorV2AdminSession(request);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "owner") {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: "owner" },
    });
  }
  const url = new URL(request.url);
  const rawWindow = Number(url.searchParams.get("windowMinutes") ?? 60);
  const windowMinutes = Number.isSafeInteger(rawWindow)
    ? Math.min(1440, Math.max(5, rawWindow))
    : 60;
  const { data, error } = await createSupabaseAdminClient().rpc(
    "get_vip_manager_slo_v15",
    {
      p_actor_admin_id: auth.actor.adminId,
      p_window_minutes: windowMinutes,
    },
  );
  if (error || !data || data.action !== "resolved") {
    return NextResponse.json(
      { ok: false, error: { code: "VIP_MANAGER_SLO_FAILED" } },
      { status: 500 },
    );
  }
  const { action: _action, ...payload } = data as Record<string, unknown>;
  void _action;
  return NextResponse.json({ ok: true, ...payload });
}
