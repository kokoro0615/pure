import { readBusinessDate, VipFloorContractError } from "@/lib/vipFloorV2Contract";
import {
  createInvalidCommandResponse,
  readVipFloorBoardV2,
  requireVipFloorV2Read,
} from "@/lib/server/vipFloorV2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireVipFloorV2Read(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);

    if (
      [...url.searchParams.keys()].some((key) => key !== "businessDate") ||
      url.searchParams.getAll("businessDate").length !== 1
    ) {
      throw new VipFloorContractError("Invalid query", "businessDate");
    }

    const businessDate = readBusinessDate(url.searchParams.get("businessDate"));
    return readVipFloorBoardV2(auth.actor, businessDate);
  } catch (error) {
    return createInvalidCommandResponse(
      error instanceof VipFloorContractError ? error.field : undefined,
    );
  }
}
