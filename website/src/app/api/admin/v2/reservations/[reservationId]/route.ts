import {
  parseReservationUpdateCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "update_admin_reservation_v22",
    action: "reservation.updated",
    parse: (body) => parseReservationUpdateCommand(body, reservationId),
  });
}
