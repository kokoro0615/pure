import {
  parseUpdateStaffMemberCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ staffMemberId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { staffMemberId } = await context.params;
  return runAdminRpcActionV2(request, {
    rpcName: "update_admin_vip_staff_member_v12",
    action: "staff_member.updated",
    parse: (body) => parseUpdateStaffMemberCommand(body, staffMemberId),
  });
}
