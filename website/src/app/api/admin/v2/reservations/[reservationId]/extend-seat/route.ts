import {
  parseSeatExtensionCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "extend_checked_in_reservation_seat_v8",
    action: "reservation.seat_extended",
    parse: (body) => parseSeatExtensionCommand(body, reservationId),
  });
}
