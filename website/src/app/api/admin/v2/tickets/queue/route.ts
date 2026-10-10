import {
  getTicketManagerOperations,
  requireTicketManagerCapability,
  requireTicketManagerOwner,
  ticketManagerJson,
  ticketManagerServerFailure,
} from "@/lib/server/tickets/ticketManagerHttp";
import {
  readTicketManagerScope,
  TicketManagerRequestError,
  ticketManagerFailure,
} from "@/lib/server/tickets/ticketManagerOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  try {
    const scope = readTicketManagerScope(request);
    const gate = requireTicketManagerCapability(scope === "refund" ? "refund" : "manager");
    if (!gate.ok) return gate.response;
    return ticketManagerJson(await getTicketManagerOperations().readQueue(scope));
  } catch (error) {
    return error instanceof TicketManagerRequestError
      ? ticketManagerJson(ticketManagerFailure("invalid_request"), 400)
      : ticketManagerServerFailure();
  }
}
