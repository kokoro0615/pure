export const TICKET_ALERT_LABELS = {
  metrics_invalid: '監視値を取得できません',
  otp_queue_aged: '認証メール待ち60秒以上',
  purchase_notice_aged: '購入通知待ち300秒以上',
  delivery_needs_review: 'メール配送の要確認あり',
  email_circuit_open: 'メール送信を一時停止中',
  checkout_review_pending: '決済の要確認あり',
  refund_review_pending: '返金の要確認あり',
  email_dispatcher_missing: 'メールworkerの応答なし',
  checkout_recovery_missing: '決済復旧workerの応答なし',
  revision_evidence_unavailable: '販売検証の証明が無効・不足',
  revision_evidence_expiring: '販売検証の証明が48時間以内に失効',
  resend_attestation_unavailable: 'メール接続の証明が無効・不足',
  resend_attestation_expiring: 'メール接続の証明が48時間以内に失効',
  notification_delivery_aged: '障害通知の配送待ち300秒以上',
  notification_delivery_failed: '障害通知の配送失敗・要確認',
  monitoring_heartbeat_missing: '監視処理の応答が180秒以上ありません',
  notification_configuration_missing: '障害通知の接続設定が不足',
  email_capacity_low: 'メール残枠のため新規購入受付を一時停止',
  email_capacity_unverified: 'メール残枠の確認が必要・新規購入受付を停止',
} as const;

export type TicketAlertCode = keyof typeof TICKET_ALERT_LABELS;
export const TICKET_HEALTH_FIELDS = ['otpOldestSeconds','purchaseOldestSeconds','deliveryDead','openCircuits',
  'checkoutReviewCount','refundReviewCount','emailHeartbeatAgeSeconds','checkoutHeartbeatAgeSeconds'] as const;

export function isTicketAlertCode(value: unknown): value is TicketAlertCode {
  return typeof value === 'string' && Object.hasOwn(TICKET_ALERT_LABELS, value);
}

/** Strict allowlist: arbitrary provider errors, recipients and customer fields never become message copy. */
export function formatTicketAlertMessage(value: unknown): string {
  if (!value || typeof value !== 'object') throw new Error('ticket_alert_payload_invalid');
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.alerts) || row.alerts.length > 20 || !row.alerts.every(isTicketAlertCode)
    || !['alert','recovery','reminder'].includes(row.status as string)) throw new Error('ticket_alert_payload_invalid');
  if ((row.status === 'recovery') !== (row.alerts.length === 0)) throw new Error('ticket_alert_payload_invalid');
  const metrics = row.metrics && typeof row.metrics === 'object' ? row.metrics as Record<string, unknown> : {};
  const lines = [row.status === 'recovery' ? '【PURE】チケット監視・復旧' : '【PURE】チケット監視・要対応',
    ...row.alerts.map(code => TICKET_ALERT_LABELS[code])];
  for (const [key, label] of [['otpOldestSeconds','認証メール待ち秒'],['purchaseOldestSeconds','購入通知待ち秒'],
    ['deliveryDead','配送要確認件数'],['checkoutReviewCount','決済要確認件数'],['refundReviewCount','返金要確認件数']] as const) {
    const number = metrics[key];
    if (typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1e12) lines.push(`${label}：${Math.ceil(number)}`);
  }
  lines.push('対応：VIP Managerのチケット対応・運用手順を確認', 'https://pure-vip-ops.vercel.app');
  return lines.join('\n');
}
