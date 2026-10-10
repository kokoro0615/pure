import 'server-only';
import {createSupabaseAdminClient} from '../supabaseAdmin';
import {ticketRevisionEvidenceAlerts} from './ticketRevisionReadiness';
import {resendActivationAlerts} from '../transactionalEmail/resendActivationEnvironment';
import {TICKET_HEALTH_FIELDS, isTicketAlertCode} from '../../tickets/ticketAlertMessage';
import {runTicketMaintenanceRpc, type TicketMaintenanceOptions} from './ticketMaintenanceRpc';
export type TicketHealth={otpOldestSeconds:number;purchaseOldestSeconds:number;deliveryDead:number;openCircuits:number;checkoutReviewCount:number;refundReviewCount:number;emailHeartbeatAgeSeconds:number|null;checkoutHeartbeatAgeSeconds:number|null};
export function parseTicketHealth(value:unknown):TicketHealth|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 for(const key of TICKET_HEALTH_FIELDS){
  const number=row[key];
  if(number===null&&(key==='emailHeartbeatAgeSeconds'||key==='checkoutHeartbeatAgeSeconds'))continue;
  if(typeof number!=='number'||!Number.isFinite(number)||number<0||number>1e12)return null;
 }
 return Object.fromEntries(TICKET_HEALTH_FIELDS.map(key=>[key,row[key]])) as TicketHealth;
}
export function ticketHealthAlerts(health:TicketHealth){
 const alerts:string[]=[];
 if(!parseTicketHealth(health))return ['metrics_invalid'];
 if(health.otpOldestSeconds>=60)alerts.push('otp_queue_aged');
 if(health.purchaseOldestSeconds>=300)alerts.push('purchase_notice_aged');
 if(health.deliveryDead>0)alerts.push('delivery_needs_review');
 if(health.openCircuits>0)alerts.push('email_circuit_open');
 if(health.checkoutReviewCount>0)alerts.push('checkout_review_pending');
 if(health.refundReviewCount>0)alerts.push('refund_review_pending');
 if(health.emailHeartbeatAgeSeconds===null||health.emailHeartbeatAgeSeconds>180)alerts.push('email_dispatcher_missing');
 if(health.checkoutHeartbeatAgeSeconds===null||health.checkoutHeartbeatAgeSeconds>180)alerts.push('checkout_recovery_missing');
 return alerts;
}
export async function recordTicketHeartbeat(worker:'email_dispatcher'|'checkout_recovery',succeeded:boolean,options:TicketMaintenanceOptions={}){const client=createSupabaseAdminClient();await runTicketMaintenanceRpc('record_ticket_worker_heartbeat_v38',signal=>client.rpc('record_ticket_worker_heartbeat_v38',{p_worker:worker,p_succeeded:succeeded}).abortSignal(signal),options);}
export async function readTicketMonitoring(){
 const db=createSupabaseAdminClient();
 // v79: the application no longer meters Resend Free capacity. Delivery age,
 // circuits and dead jobs below remain warnings; none of them stops purchases.
 const [{data,error},delivery]=await Promise.all([
  db.rpc('read_ticket_delivery_health_v38'), db.rpc('read_ticket_alert_delivery_health_v42'),
 ]);
 const metrics=!error?parseTicketHealth(data):null;
 const alerts=[...(metrics?ticketHealthAlerts(metrics):['metrics_invalid']),...ticketRevisionEvidenceAlerts(),...resendActivationAlerts(process.env)];
 if(process.env.FEATURE_TICKET_HEALTH_NOTIFICATIONS_ENABLED==='true'){
  if(!ticketAlertConfigurationReady())alerts.push('notification_configuration_missing');
  if(delivery.error||!delivery.data||typeof delivery.data.deliveryFailed!=='boolean'
   ||!Number.isFinite(delivery.data.pendingOldestSeconds)||delivery.data.pendingOldestSeconds<0
   ||!(delivery.data.heartbeatAgeSeconds===null||Number.isFinite(delivery.data.heartbeatAgeSeconds)&&delivery.data.heartbeatAgeSeconds>=0))alerts.push('notification_delivery_failed');
  else {
   if(delivery.data.deliveryFailed)alerts.push('notification_delivery_failed');
   if(delivery.data.pendingOldestSeconds>=300)alerts.push('notification_delivery_aged');
   if(delivery.data.heartbeatAgeSeconds===null||delivery.data.heartbeatAgeSeconds>180)alerts.push('monitoring_heartbeat_missing');
  }
 }
 return {metrics,alerts};
}

function ticketAlertConfigurationReady(){return /^C[a-f0-9]{32}$/.test(process.env.TICKET_HEALTH_LINE_GROUP_ID??'')
 &&process.env.FEATURE_LINE_NOTIFICATIONS_ENABLED==='true'&&!!process.env.LINE_CHANNEL_ACCESS_TOKEN;}

/** Uses the already leased/retried LINE outbox. No implicit daily-report target. */
export async function dispatchTicketMonitoring(result:{metrics:TicketHealth|null;alerts:string[]}){
 if(process.env.FEATURE_TICKET_HEALTH_NOTIFICATIONS_ENABLED!=='true')return {action:'disabled'};
 if(!ticketAlertConfigurationReady())throw new Error('ticket_alert_configuration_missing');
 if(!result.alerts.every(isTicketAlertCode))throw new Error('ticket_alert_code_invalid');
 const metrics=Object.fromEntries(TICKET_HEALTH_FIELDS.map(key=>[key,result.metrics?.[key]??null]));
 const {data,error}=await createSupabaseAdminClient().rpc('enqueue_ticket_alerts_v42',{
  p_line_target_id:process.env.TICKET_HEALTH_LINE_GROUP_ID,p_alerts:result.alerts,p_metrics:metrics,
 });
 if(error||!data||data.action==='review_required')throw new Error('ticket_alert_dispatch_unavailable');
 return {action:data.action,status:data.status??null};
}
// Adapter deliberately has no default destination. Approval/configuration of an
// external notifier is independent of implementing and locally testing alerts.
export async function deliverTicketAlerts(health:TicketHealth,notify:(event:{kind:'ghost.ticket.alert';alerts:string[]})=>Promise<void>){const alerts=ticketHealthAlerts(health);if(alerts.length)await notify({kind:'ghost.ticket.alert',alerts});return alerts;}
