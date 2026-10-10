import {
  getTicketManagerOperations,
  requireTicketManagerCapability,
  requireTicketManagerOwner,
  ticketManagerJson,
  ticketManagerOperationResponse,
} from "@/lib/server/tickets/ticketManagerHttp";
import {
  readTicketManagerCommand,
  ticketManagerFailure,
} from "@/lib/server/tickets/ticketManagerOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  const gate = requireTicketManagerCapability("email");
  if (!gate.ok) return gate.response;
  try {
    const { command, idempotencyKey } = await readTicketManagerCommand(request, "email_retry");
    return ticketManagerOperationResponse(await getTicketManagerOperations().retryEmail({
      actorAdminId: auth.actor.adminId,
      requestId: auth.actor.requestId,
      idempotencyKey,
    }, command));
  } catch {
    return ticketManagerJson(ticketManagerFailure("invalid_request"), 400);
  }
}
