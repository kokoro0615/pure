import {
  parseEmailNotificationCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "enqueue_admin_reservation_email_v10",
    action: "reservation.email.enqueued",
    requiredCapability: "customer_profile.write",
    parse: (body) => parseEmailNotificationCommand(body, reservationId),
  });
}
