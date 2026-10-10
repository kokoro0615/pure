import type { RenderedTransactionalEmail } from "./types";

export type TransactionalEmailProviderCategory =
  | "authentication"
  | "domain_not_verified"
  | "daily_quota_exceeded"
  | "monthly_quota_exceeded"
  | "idempotency_conflict"
  | "idempotency_in_progress"
  | "invalid_provider_response"
  | "invalid_request"
  | "network"
  | "payload_hash_mismatch"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "unknown";

export type TransactionalEmailProviderReceipt =
  | Readonly<{
    outcome: "accepted";
    providerMessageId: string;
  }>
  | Readonly<{
    outcome: "retryable";
    category: TransactionalEmailProviderCategory;
    retryAfterMs?: number;
  }>
  | Readonly<{
    outcome: "permanent" | "configuration";
    category: TransactionalEmailProviderCategory;
  }>;

export type TransactionalEmailProviderSendRequest = Readonly<{
  idempotencyKey: string;
  timeoutMs: number;
}>;

export interface TransactionalEmailProviderPort {
  readonly providerName: "fake" | "resend";
  send(
    rendered: RenderedTransactionalEmail,
    request: TransactionalEmailProviderSendRequest,
  ): Promise<TransactionalEmailProviderReceipt>;
}

export type TransactionalEmailWebhookHeaders = Readonly<{
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
}>;

export type VerifiedTransactionalEmailProviderEvent = Readonly<{
  provider: "resend";
  providerEventId: string;
  eventType: string;
  recognized: boolean;
  occurredAt: string;
  providerMessageId: string | null;
  /** Ephemeral only: hash immediately and never persist or log this value. */
  recipient: string | null;
  notificationJobId: string | null;
  correlationState: "valid" | "missing" | "invalid";
}>;

export interface TransactionalEmailWebhookVerifierPort {
  verifyWebhook(input: Readonly<{
    rawBody: string;
    headers: TransactionalEmailWebhookHeaders;
  }>): VerifiedTransactionalEmailProviderEvent;
}

export function isValidProviderSendRequest(request: TransactionalEmailProviderSendRequest) {
  return typeof request === "object"
    && request !== null
    && typeof request.idempotencyKey === "string"
    && /^[A-Za-z0-9._:/-]{1,256}$/u.test(request.idempotencyKey)
    && Number.isSafeInteger(request.timeoutMs)
    && request.timeoutMs >= 100
    && request.timeoutMs <= 30_000;
}
