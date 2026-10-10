import {
  parseWaitlistTransitionCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ waitlistEntryId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { waitlistEntryId } = await context.params;
  return runAdminRpcActionV2(request, {
    rpcName: "transition_admin_waitlist_entry_v11",
    action: "waitlist.cancelled",
    parse: (body) => parseWaitlistTransitionCommand(body, waitlistEntryId, "cancelled"),
  });
}
