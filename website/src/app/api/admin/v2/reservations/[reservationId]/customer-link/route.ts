import {
  parseReservationCustomerRelinkCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "relink_admin_reservation_customer_v14",
    action: "reservation.customer_relinked",
    parse: (body) => parseReservationCustomerRelinkCommand(body, reservationId),
  });
}
