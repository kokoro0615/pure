import { NextResponse } from "next/server";

import { VIP_MANAGER_MAX_BUSINESS_DAY_SUGGESTIONS } from "@/generated/vipManagerRuntimeContract";
import { requireVipFloorV2Read } from "@/lib/server/vipFloorV2";
import { executeVipManagerBusinessDaysRequest } from "@/lib/server/vipManagerBusinessDaysRuntime.mjs";
import {
  parseBusinessDayEnsureCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  readBusinessDate,
  VipFloorContractError,
} from "@/lib/vipFloorV2Contract";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await executeVipManagerBusinessDaysRequest(request, {
    authorize: async (candidateRequest: Request) => {
      const auth = await requireVipFloorV2Read(candidateRequest);
      return auth.ok
        ? { ok: true as const, actor: auth.actor }
        : { ok: false as const, response: auth.response };
    },
    readBusinessDate,
    maximumSuggestions: VIP_MANAGER_MAX_BUSINESS_DAY_SUGGESTIONS,
    listBusinessDays: async (afterBusinessDate: string, limit: number) => {
      const query = await createSupabaseAdminClient()
        .from("event_days")
        .select("business_date")
        .eq("operating_status", "open")
        .gt("business_date", afterBusinessDate)
        .order("business_date", { ascending: true })
        .limit(limit);
      if (query.error) throw query.error;
      return query.data ?? [];
    },
    isContractError: (error: unknown): error is VipFloorContractError =>
      error instanceof VipFloorContractError,
  });

  if (result instanceof Response) return result;
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function POST(request: Request) {
  return runAdminRpcActionV2(request, {
    rpcName: "ensure_admin_event_day_v80",
    action: "business_day.ensured",
    parse: parseBusinessDayEnsureCommand,
  });
}
