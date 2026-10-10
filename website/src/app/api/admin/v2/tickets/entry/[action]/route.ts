import { getTicketManagerOperations, requireTicketManagerCapability, requireTicketManagerOwner, ticketManagerJson, ticketManagerOperationResponse } from "@/lib/server/tickets/ticketManagerHttp";
import { readTicketManagerCommand, ticketManagerFailure, type TicketEntryRecoveryAction } from "@/lib/server/tickets/ticketManagerOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const auth = await requireTicketManagerOwner(request);
  if (!auth.ok) return auth.response;
  const action = `entry_${(await context.params).action}`;
  if (!["entry_rotate", "entry_revoke", "entry_resend", "entry_exception"].includes(action)) return ticketManagerJson(ticketManagerFailure("invalid_request"), 404);
  const gate = requireTicketManagerCapability("manager");
  if (!gate.ok) return gate.response;
  try {
    const { command, idempotencyKey } = await readTicketManagerCommand(request, action as TicketEntryRecoveryAction);
    return ticketManagerOperationResponse(await getTicketManagerOperations().recoverEntry({ actorAdminId: auth.actor.adminId, requestId: auth.actor.requestId, idempotencyKey }, command));
  } catch { return ticketManagerJson(ticketManagerFailure("invalid_request"), 400); }
}
