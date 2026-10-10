import {requireTicketManagerOwner,ticketManagerJson,ticketManagerServerFailure} from '@/lib/server/tickets/ticketManagerHttp';
import {readTicketMonitoring} from '@/lib/server/tickets/ticketMonitoring';
export const runtime='nodejs';
export async function GET(request:Request){const auth=await requireTicketManagerOwner(request);if(!auth.ok)return auth.response;try{return ticketManagerJson({ok:true,...await readTicketMonitoring()});}catch{return ticketManagerServerFailure();}}
