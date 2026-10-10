import {
  getTicketManagerOperations,
  requireTicketManagerCapability,
  requireTicketManagerOwner,
  ticketManagerOperationResponse,
} from "@/lib/server/tickets/ticketManagerHttp";
import {
  readTicketManagerCommand,
  ticketManagerFailure,
} from "@/lib/server/tickets/ticketManagerOperations";
import { ticketManagerJson } from "@/lib/server/tickets/ticketManagerHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  const gate = requireTicketManagerCapability("manager");
  if (!gate.ok) return gate.response;
  try {
    const { command, idempotencyKey } = await readTicketManagerCommand(request, "session_revoke");
    return ticketManagerOperationResponse(await getTicketManagerOperations().revokeSession({
      actorAdminId: auth.actor.adminId,
      requestId: auth.actor.requestId,
      idempotencyKey,
    }, command));
  } catch {
    return ticketManagerJson(ticketManagerFailure("invalid_request"), 400);
  }
}
