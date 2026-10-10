import {
  parseTableStaffAssignmentCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return runAdminRpcActionV2(request, {
    rpcName: "set_admin_vip_table_staff_assignment_v12",
    action: "table_staff_assignment.set",
    parse: parseTableStaffAssignmentCommand,
  });
}
