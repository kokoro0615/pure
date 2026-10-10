import {
  parseCancelVipBlockCommand,
  parseUpdateVipBlockCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ blockId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { blockId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "update_admin_reservation_block_v8",
    action: "reservation_block.updated",
    parse: (body) => parseUpdateVipBlockCommand(body, blockId),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { blockId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "cancel_admin_reservation_block_v8",
    action: "reservation_block.cancelled",
    parse: (body) => parseCancelVipBlockCommand(body, blockId),
  });
}
