import {
  parseCustomerAttributesCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { customerId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "update_admin_customer_attributes_v14",
    action: "customer_profile.attributes_updated",
    parse: (body) => parseCustomerAttributesCommand(body, customerId),
  });
}
