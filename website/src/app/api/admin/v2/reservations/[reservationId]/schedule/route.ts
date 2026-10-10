import {
  parseScheduleCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "set_admin_reservation_schedule_v8",
    action: "reservation.schedule.updated",
    parse: (body) => parseScheduleCommand(body, reservationId),
  });
}
