import {
  parseServiceStatusCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "set_admin_reservation_service_status_v8",
    action: "reservation.service_status.updated",
    parse: (body) => parseServiceStatusCommand(body, reservationId),
  });
}
