import {
  parseCreateVipBlockSeriesCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runAdminRpcActionV2(request, {
    rpcName: "create_admin_reservation_block_series_v21",
    action: "reservation_block.series_created",
    parse: parseCreateVipBlockSeriesCommand,
  });
}
