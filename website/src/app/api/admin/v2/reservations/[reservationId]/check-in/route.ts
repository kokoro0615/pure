import {
  parseCheckInCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "check_in_admin_reservation_v8",
    action: "reservation.checked_in",
    requiredCapability: "service_status.write",
    parse: (body) => parseCheckInCommand(body, reservationId),
  });
}
