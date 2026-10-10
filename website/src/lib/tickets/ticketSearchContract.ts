export type TicketSearchRequest={email:string;from:string;through:string;reason:'email_not_received'|'order_code_unknown'|'reconciliation';cursor:{createdAt:string;id:string}|null};
export type TicketSearchResponse={ok:true;orders:{publicCode:string;eventDate:string;eventTitle:string;status:string;quantity:number}[];nextCursor:TicketSearchRequest['cursor'];hasMore:boolean;auditId:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function date(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function parseTicketSearchRequest(value:unknown):TicketSearchRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_search');const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['email','from','through','reason','cursor'].includes(k))||typeof v.email!=='string'||v.email.length>254||! /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v.email.trim())||!date(v.from)||!date(v.through)||v.from>v.through||Date.parse(v.through)-Date.parse(v.from)>366*86400000||!['email_not_received','order_code_unknown','reconciliation'].includes(String(v.reason)))throw new Error('invalid_search');
 let cursor:TicketSearchRequest['cursor']=null;
 if(v.cursor!==null&&v.cursor!==undefined){const c=v.cursor as Record<string,unknown>;if(!c||typeof c!=='object'||Object.keys(c).some(k=>!['createdAt','id'].includes(k))||typeof c.createdAt!=='string'||!Number.isFinite(Date.parse(c.createdAt))||typeof c.id!=='string'||!uuid.test(c.id))throw new Error('invalid_search');cursor={createdAt:c.createdAt,id:c.id};}
 return {email:v.email.trim().toLowerCase(),from:v.from,through:v.through,reason:v.reason as TicketSearchRequest['reason'],cursor};
}
export function parseTicketSearchResponse(value:unknown):TicketSearchResponse{
 const v=value as TicketSearchResponse;
 if(!v||v.ok!==true||!Array.isArray(v.orders)||v.orders.length>25||typeof v.hasMore!=='boolean'||!uuid.test(v.auditId))throw new Error('invalid_search_response');
 const orders=v.orders.map(o=>{if(!o||!/^GT-[A-Z0-9]{10}$/.test(o.publicCode)||!date(o.eventDate)||typeof o.eventTitle!=='string'||o.eventTitle.length>240||!['pending','paid','fulfilled','cancelled','expired','refunded'].includes(o.status)||!Number.isInteger(o.quantity)||o.quantity<1||o.quantity>20)throw new Error('invalid_search_response');return{publicCode:o.publicCode,eventDate:o.eventDate,eventTitle:o.eventTitle,status:o.status,quantity:o.quantity};});
 if(v.hasMore!==Boolean(v.nextCursor)||v.nextCursor&&(!uuid.test(v.nextCursor.id)||!Number.isFinite(Date.parse(v.nextCursor.createdAt))))throw new Error('invalid_search_response');
 return {ok:true,orders,hasMore:v.hasMore,nextCursor:v.nextCursor?{id:v.nextCursor.id,createdAt:v.nextCursor.createdAt}:null,auditId:v.auditId};
}
