import {
  parseArrivalTimeCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "set_admin_reservation_arrival_time_v9",
    action: "reservation.arrival_time.updated",
    requiredCapability: "service_status.write",
    parse: (body) => parseArrivalTimeCommand(body, reservationId),
  });
}
