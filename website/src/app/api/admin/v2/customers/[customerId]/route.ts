import { VipFloorContractError, readStrictUuid } from "@/lib/vipFloorV2Contract";
import {
  createInvalidCommandResponse,
  readVipFloorCustomerV2,
  requireVipFloorV2Read,
} from "@/lib/server/vipFloorV2";
import {
  parseCustomerProfileCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireVipFloorV2Read(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { customerId: rawCustomerId } = await context.params;
    const customerId = readStrictUuid(rawCustomerId, "customerId");
    return readVipFloorCustomerV2(auth.actor, customerId);
  } catch (error) {
    return createInvalidCommandResponse(
      error instanceof VipFloorContractError ? error.field : undefined,
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { customerId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "upsert_admin_customer_profile_v8",
    action: "customer_profile.upserted",
    requireCustomerProfileWriteFlag: true,
    parse: (body) => parseCustomerProfileCommand(body, customerId),
  });
}
