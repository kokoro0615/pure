import "server-only";

import { Resend } from "resend";
import { assertPureEmailRecipient, isPureLocalEmailTest, reservePureLocalEmail } from "../pureLocalEmail";

import {
  canonicalizeTransactionalEmailPayload,
  hashTransactionalEmailPayload,
} from "./renderer";
import { isResendSecretValue } from "./resendRuntimeConfiguration";
import {
  isValidProviderSendRequest,
  type TransactionalEmailProviderPort,
  type TransactionalEmailProviderReceipt,
  type TransactionalEmailProviderSendRequest,
  type TransactionalEmailWebhookHeaders,
  type TransactionalEmailWebhookVerifierPort,
  type VerifiedTransactionalEmailProviderEvent,
} from "./provider";
import type { RenderedTransactionalEmail } from "./types";
import { hashPurchaserEmail } from "../tickets/admissionCodes";
import {
  assertTicketLocalTestRecipientAllowed,
  readTicketLocalTestAuthority,
} from "../tickets/ticketLocalTestAuthority";
import {
  assertTicketCanaryRecipientAllowed,
  readTicketCanaryRuntimeAuthority,
} from "../tickets/ticketCanaryRuntimeGuard";

const RESEND_SEND_ENDPOINT = "https://api.resend.com/emails";
const PROVIDER_MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAXIMUM_PROVIDER_RESPONSE_BYTES = 64 * 1_024;
const MAXIMUM_WEBHOOK_BODY_BYTES = 256 * 1_024;
const MAXIMUM_WEBHOOK_HEADER_BYTES = 4_096;
const WEBHOOK_TIMESTAMP_WINDOW_MS = 5 * 60 * 1_000;
const PROVIDER_EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/u;
const NOTIFICATION_JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECOGNIZED_EMAIL_EVENT_TYPES = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

type ResendTransactionalEmailProviderOptions = {
  apiKey: string;
  webhookSecrets: readonly string[];
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
};

export class ResendWebhookVerificationError extends Error {
  readonly code:
    | "RESEND_WEBHOOK_INVALID_REQUEST"
    | "RESEND_WEBHOOK_TIMESTAMP_INVALID"
    | "RESEND_WEBHOOK_INVALID_SIGNATURE"
    | "RESEND_WEBHOOK_PAYLOAD_INVALID";

  constructor(
    code:
      | "RESEND_WEBHOOK_INVALID_REQUEST"
      | "RESEND_WEBHOOK_TIMESTAMP_INVALID"
      | "RESEND_WEBHOOK_INVALID_SIGNATURE"
      | "RESEND_WEBHOOK_PAYLOAD_INVALID",
  ) {
    super(code);
    this.name = "ResendWebhookVerificationError";
    this.code = code;
  }
}

export class ResendTransactionalEmailProvider implements
  TransactionalEmailProviderPort,
  TransactionalEmailWebhookVerifierPort {
  readonly providerName = "resend" as const;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #timeoutSignal: (milliseconds: number) => AbortSignal;
  readonly #resend: Resend;
  readonly #webhookSecrets: readonly string[];

  constructor(options: ResendTransactionalEmailProviderOptions) {
    if (
      !isResendSecretValue(options.apiKey)
      || !Array.isArray(options.webhookSecrets)
      || (options.webhookSecrets.length === 0 && !isPureLocalEmailTest())
      || options.webhookSecrets.length > 3
      || options.webhookSecrets.some((secret) => !isResendSecretValue(secret))
      || new Set(options.webhookSecrets).size !== options.webhookSecrets.length
    ) {
      throw new Error("RESEND_PROVIDER_INVALID_CONFIG");
    }
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#timeoutSignal = options.timeoutSignal ?? AbortSignal.timeout.bind(AbortSignal);
    this.#resend = new Resend(options.apiKey);
    this.#webhookSecrets = Object.freeze([...options.webhookSecrets]);
  }

  async send(
    rendered: RenderedTransactionalEmail,
    request: TransactionalEmailProviderSendRequest,
  ): Promise<TransactionalEmailProviderReceipt> {
    try {
      assertPureEmailRecipient(rendered.message.recipient);
    } catch {
      return frozenReceipt({ outcome: "configuration", category: "invalid_request" });
    }
    if (readTicketCanaryRuntimeAuthority().enabled) {
      try {
        const recipientHash = hashPurchaserEmail(rendered.message.recipient);
        assertTicketCanaryRecipientAllowed(
          recipientHash ? `sha256:${recipientHash}` : "invalid",
        );
      } catch {
        return frozenReceipt({ outcome: "configuration", category: "invalid_request" });
      }
    }
    if (readTicketLocalTestAuthority().enabled) {
      try {
        const recipientHash = hashPurchaserEmail(rendered.message.recipient);
        assertTicketLocalTestRecipientAllowed(
          recipientHash ? `sha256:${recipientHash}` : "invalid",
        );
      } catch {
        return frozenReceipt({ outcome: "configuration", category: "invalid_request" });
      }
    }
    if (!isValidProviderSendRequest(request)) {
      return frozenReceipt({ outcome: "configuration", category: "invalid_request" });
    }
    if (hashTransactionalEmailPayload(rendered.message) !== rendered.payloadHash) {
      return frozenReceipt({ outcome: "configuration", category: "payload_hash_mismatch" });
    }

    let response: Response;
    try {
      await reservePureLocalEmail(request.idempotencyKey);
      response = await this.#fetch(RESEND_SEND_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.idempotencyKey,
          "User-Agent": "pure-ticket-wallet/1.0",
        },
        body: canonicalizeTransactionalEmailPayload(rendered.message),
        cache: "no-store",
        redirect: "error",
        signal: this.#timeoutSignal(request.timeoutMs),
      });
    } catch (error) {
      return isAbortError(error)
        ? frozenReceipt({ outcome: "retryable", category: "timeout" })
        : frozenReceipt({ outcome: "retryable", category: "network" });
    }

    let rawBody: string | null;
    try {
      rawBody = await readBoundedResponseBody(response);
    } catch (error) {
      return isAbortError(error)
        ? frozenReceipt({ outcome: "retryable", category: "timeout" })
        : frozenReceipt({ outcome: "retryable", category: "network" });
    }
    const body = parseProviderBody(rawBody);
    if (response.ok) {
      const providerMessageId = readProviderMessageId(body);
      return providerMessageId
        ? frozenReceipt({ outcome: "accepted", providerMessageId })
        : frozenReceipt({ outcome: "retryable", category: "invalid_provider_response" });
    }

    return classifyFailure(response, body, this.#now());
  }

  verifyWebhook(input: Readonly<{
    rawBody: string;
    headers: TransactionalEmailWebhookHeaders;
  }>): VerifiedTransactionalEmailProviderEvent {
    validateWebhookEnvelope(input);
    const timestampMs = Number(input.headers["svix-timestamp"]) * 1_000;
    if (Math.abs(this.#now() - timestampMs) > WEBHOOK_TIMESTAMP_WINDOW_MS) {
      throw new ResendWebhookVerificationError("RESEND_WEBHOOK_TIMESTAMP_INVALID");
    }

    let verifiedPayload: unknown = null;
    for (const webhookSecret of this.#webhookSecrets) {
      try {
        verifiedPayload = this.#resend.webhooks.verify({
          payload: input.rawBody,
          headers: {
            id: input.headers["svix-id"],
            timestamp: input.headers["svix-timestamp"],
            signature: input.headers["svix-signature"],
          },
          webhookSecret,
        });
        break;
      } catch {
        // Try the next bounded rotation secret without exposing SDK errors.
      }
    }
    if (verifiedPayload === null) {
      throw new ResendWebhookVerificationError("RESEND_WEBHOOK_INVALID_SIGNATURE");
    }
    return normalizeVerifiedWebhook(
      input.headers["svix-id"],
      verifiedPayload,
    );
  }
}

function validateWebhookEnvelope(input: Readonly<{
  rawBody: string;
  headers: TransactionalEmailWebhookHeaders;
}>) {
  if (
    typeof input.rawBody !== "string"
    || input.rawBody.length === 0
    || Buffer.byteLength(input.rawBody, "utf8") > MAXIMUM_WEBHOOK_BODY_BYTES
    || !PROVIDER_EVENT_ID_PATTERN.test(input.headers["svix-id"])
    || !/^\d{1,12}$/u.test(input.headers["svix-timestamp"])
    || !isBoundedWebhookHeader(input.headers["svix-signature"])
  ) {
    throw new ResendWebhookVerificationError("RESEND_WEBHOOK_INVALID_REQUEST");
  }
  const timestamp = Number(input.headers["svix-timestamp"]);
  if (!Number.isSafeInteger(timestamp)) {
    throw new ResendWebhookVerificationError("RESEND_WEBHOOK_TIMESTAMP_INVALID");
  }
}

function normalizeVerifiedWebhook(
  providerEventId: string,
  verifiedPayload: unknown,
): VerifiedTransactionalEmailProviderEvent {
  if (
    !isRecord(verifiedPayload)
    || typeof verifiedPayload.type !== "string"
    || !/^[a-z0-9_.-]{1,100}$/u.test(verifiedPayload.type)
    || typeof verifiedPayload.created_at !== "string"
  ) {
    throw new ResendWebhookVerificationError("RESEND_WEBHOOK_PAYLOAD_INVALID");
  }
  const occurredAt = readCanonicalTimestamp(verifiedPayload.created_at);
  const data = isRecord(verifiedPayload.data) ? verifiedPayload.data : null;
  const providerMessageId = data && typeof data.email_id === "string"
    && PROVIDER_MESSAGE_ID_PATTERN.test(data.email_id)
    ? data.email_id
    : null;
  const recipient = data && Array.isArray(data.to) && data.to.length === 1
    && isSafeRecipient(data.to[0])
    ? data.to[0]
    : null;
  const tags = data && isRecord(data.tags) ? data.tags : null;
  const jobTag = tags?.notification_job_id;
  const notificationJobId = typeof jobTag === "string"
    && NOTIFICATION_JOB_ID_PATTERN.test(jobTag)
    ? jobTag
    : null;
  const correlationState = jobTag === undefined
    ? "missing"
    : notificationJobId ? "valid" : "invalid";

  if (verifiedPayload.type.startsWith("email.") && (!providerMessageId || !recipient)) {
    throw new ResendWebhookVerificationError("RESEND_WEBHOOK_PAYLOAD_INVALID");
  }
  return Object.freeze({
    provider: "resend",
    providerEventId,
    eventType: verifiedPayload.type,
    recognized: RECOGNIZED_EMAIL_EVENT_TYPES.has(verifiedPayload.type),
    occurredAt,
    providerMessageId,
    recipient,
    notificationJobId,
    correlationState,
  });
}

function readProviderMessageId(body: unknown) {
  if (!isRecord(body) || typeof body.id !== "string" || !PROVIDER_MESSAGE_ID_PATTERN.test(body.id)) {
    return null;
  }
  return body.id;
}

async function readBoundedResponseBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_PROVIDER_RESPONSE_BYTES) {
    return null;
  }
  const body = await response.text();
  return Buffer.byteLength(body, "utf8") <= MAXIMUM_PROVIDER_RESPONSE_BYTES ? body : null;
}

function parseProviderBody(rawBody: string | null) {
  if (rawBody === null || rawBody.length === 0) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function classifyFailure(response: Response, body: unknown, now: number): TransactionalEmailProviderReceipt {
  const errorName = readProviderErrorName(body);
  if (response.status === 409 && errorName === "concurrent_idempotent_requests") {
    return frozenReceipt({ outcome: "retryable", category: "idempotency_in_progress" });
  }
  if (response.status === 409 && errorName === "invalid_idempotent_request") {
    return frozenReceipt({ outcome: "permanent", category: "idempotency_conflict" });
  }
  if (response.status === 429) {
    if (errorName === "daily_quota_exceeded") {
      const nextUtcDay = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
      return frozenReceipt({ outcome: "retryable", category: "daily_quota_exceeded", retryAfterMs: nextUtcDay - now });
    }
    if (errorName === "monthly_quota_exceeded") {
      return frozenReceipt({ outcome: "configuration", category: "monthly_quota_exceeded" });
    }
    const retryAfterMs = readRetryAfterMs(response.headers.get("retry-after"), now);
    return retryAfterMs === undefined
      ? frozenReceipt({ outcome: "retryable", category: "rate_limited" })
      : frozenReceipt({ outcome: "retryable", category: "rate_limited", retryAfterMs });
  }
  if (response.status === 401) {
    return frozenReceipt({ outcome: "configuration", category: "authentication" });
  }
  if (response.status === 403) {
    return errorName === "invalid_api_key"
      ? frozenReceipt({ outcome: "configuration", category: "authentication" })
      : frozenReceipt({ outcome: "configuration", category: "domain_not_verified" });
  }
  if (response.status === 408) {
    return frozenReceipt({ outcome: "retryable", category: "timeout" });
  }
  if (response.status >= 500) {
    return frozenReceipt({ outcome: "retryable", category: "provider_unavailable" });
  }
  if (response.status >= 400 && response.status < 500) {
    return frozenReceipt({ outcome: "permanent", category: "invalid_request" });
  }
  return frozenReceipt({ outcome: "retryable", category: "invalid_provider_response" });
}

function readProviderErrorName(body: unknown) {
  return isRecord(body)
    && typeof body.name === "string"
    && /^[a-z0-9_]{1,80}$/u.test(body.name)
    ? body.name
    : null;
}

function readRetryAfterMs(value: string | null, now: number) {
  if (!value) return undefined;
  const normalized = value.trim();
  if (/^\d+(?:\.\d{1,3})?$/u.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 86_400
      ? Math.ceil(seconds * 1_000)
      : undefined;
  }
  const retryAt = Date.parse(normalized);
  const delay = retryAt - now;
  return Number.isFinite(retryAt) && delay >= 0 && delay <= 86_400_000
    ? delay
    : undefined;
}

function frozenReceipt<T extends TransactionalEmailProviderReceipt>(receipt: T) {
  return Object.freeze(receipt);
}

function isBoundedWebhookHeader(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= MAXIMUM_WEBHOOK_HEADER_BYTES
    && !/[\r\n\0]/u.test(value);
}

function readCanonicalTimestamp(value: string) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new ResendWebhookVerificationError("RESEND_WEBHOOK_PAYLOAD_INVALID");
  }
  return value;
}

function isSafeRecipient(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 320
    && value.trim() === value
    && !/[\r\n\0]/u.test(value);
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))
    || (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
