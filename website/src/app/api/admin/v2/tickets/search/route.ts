import {requireTicketManagerOwner,requireTicketManagerCapability,ticketManagerJson,ticketManagerServerFailure} from '@/lib/server/tickets/ticketManagerHttp';
import {readBoundedJsonObject} from '@/lib/server/tickets/ticketWalletHttp';
import {readRuntimeEnvironment} from '@/lib/server/runtimeEnvironment';
import {parseTicketSearchRequest,parseTicketSearchResponse} from '@/lib/tickets/ticketSearchContract';
import {hashPurchaserEmail} from '@/lib/server/tickets/admissionCodes';
import {createSupabaseAdminClient} from '@/lib/server/supabaseAdmin';
export const runtime='nodejs';
export async function POST(request:Request){
 const auth=await requireTicketManagerOwner(request);if(!auth.ok)return auth.response;
 const gate=requireTicketManagerCapability('manager');if(!gate.ok)return gate.response;
 let query;try{if(request.headers.get('content-type')!=='application/json')throw new Error();query=parseTicketSearchRequest(await readBoundedJsonObject(request,4096));}catch{return ticketManagerJson({ok:false,error:'invalid_request'},400);}
 try{
  const {data,error}=await createSupabaseAdminClient().rpc('search_ticket_orders_v37',{p_actor_admin_id:auth.actor.adminId,p_request_id:auth.actor.requestId,p_environment:readRuntimeEnvironment(),p_email_hash:hashPurchaserEmail(query.email),p_from:query.from,p_through:query.through,p_reason:query.reason,p_cursor_created_at:query.cursor?.createdAt??null,p_cursor_id:query.cursor?.id??null});
  if(error||!data)return ticketManagerServerFailure();
  if(data.action==='rate_limited')return ticketManagerJson({ok:false,error:'rate_limited'},429);
  if(data.action==='forbidden')return ticketManagerJson({ok:false,error:'forbidden'},403);
  return ticketManagerJson(parseTicketSearchResponse(data));
 }catch{return ticketManagerServerFailure();}
}
