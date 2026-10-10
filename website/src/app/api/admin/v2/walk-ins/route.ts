import {
  parseWalkInCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runAdminRpcActionV2(request, {
    rpcName: "create_admin_walk_in_reservation_v23",
    action: "walk_in.created",
    parse: parseWalkInCommand,
  });
}
