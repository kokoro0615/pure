import {
  parseAssignmentCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "change_admin_reservation_assignments_v8",
    action: "reservation.assignments.changed",
    parse: (body) => parseAssignmentCommand(body, reservationId),
  });
}
