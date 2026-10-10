import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/server/featureFlags";
import { readTicketManagerCapabilities } from "@/lib/server/tickets/ticketManagerOperations";
import { getTicketWalletReadiness } from "@/lib/server/ticketWalletReadiness";
import {
  createVipFloorErrorResponse,
  requireVipFloorV2AdminSession,
} from "@/lib/server/vipFloorV2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await requireVipFloorV2AdminSession(request);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "owner") {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: "owner" },
    });
  }
  const readiness = getTicketWalletReadiness();
  return NextResponse.json(readTicketManagerCapabilities({
    managerFlagEnabled: isFeatureEnabled("FEATURE_TICKET_MANAGER_OPERATIONS_ENABLED"),
    refundFlagEnabled: isFeatureEnabled("FEATURE_TICKET_REFUND_REVIEW_ENABLED"),
    managerReady: readiness.managerOperations.ok,
    refundReady: readiness.refundReview.ok,
  }), {
    headers: {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}
