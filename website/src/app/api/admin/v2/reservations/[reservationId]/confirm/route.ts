import {
  parseConfirmationCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "confirm_admin_reservation_v8",
    action: "reservation.confirmed",
    requiredCapability: "reservation_assignment.write",
    parse: (body) => parseConfirmationCommand(body, reservationId),
  });
}
