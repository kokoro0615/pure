import "server-only";

import type {
  TransactionalEmailWebhookHeaders,
  TransactionalEmailWebhookVerifierPort,
} from "./provider";

const MAXIMUM_WEBHOOK_BODY_BYTES = 256 * 1_024;
const MAXIMUM_RECIPIENT_HASH_BYTES = 512;

export type TransactionalEmailProviderEventCommand = Readonly<{
  provider: "resend";
  providerEventId: string;
  eventType: string;
  recognized: boolean;
  occurredAt: string;
  providerMessageId: string | null;
  recipientHash: string | null;
  notificationJobId: string | null;
  correlationState: "valid" | "missing" | "invalid";
}>;

export interface TransactionalEmailWebhookRepository {
  recordProviderEvent(command: TransactionalEmailProviderEventCommand): Promise<Readonly<{
    action: "stored" | "duplicate" | "security_review";
    deliveryState: string;
  }>>;
}

export function createTransactionalEmailWebhookHandler(dependencies: Readonly<{
  verifier: TransactionalEmailWebhookVerifierPort;
  repository: TransactionalEmailWebhookRepository;
  /** This function receives raw recipient data ephemerally and must return a keyed hash. */
  hashRecipient(recipient: string): string;
}>) {
  return async function handleTransactionalEmailWebhook(request: Request) {
    const declaredLength = readDeclaredLength(request.headers.get("content-length"));
    if (declaredLength === "too_large") return webhookResponse(413, {
      ok: false,
      error: "payload_too_large",
    });
    if (declaredLength === "invalid") return webhookResponse(400, {
      ok: false,
      error: "invalid_webhook",
    });

    let rawBody: string;
    try {
      rawBody = await readBoundedRawBody(request);
    } catch (error) {
      return error instanceof WebhookBodyTooLargeError
        ? webhookResponse(413, { ok: false, error: "payload_too_large" })
        : webhookResponse(400, { ok: false, error: "invalid_webhook" });
    }

    try {
      const verified = dependencies.verifier.verifyWebhook({
        rawBody,
        headers: readSignatureHeaders(request.headers),
      });
      const recipientHash = verified.recipient === null
        ? null
        : dependencies.hashRecipient(verified.recipient);
      if (
        recipientHash !== null
        && (recipientHash.length === 0
          || Buffer.byteLength(recipientHash, "utf8") > MAXIMUM_RECIPIENT_HASH_BYTES
          || /[\r\n\0]/u.test(recipientHash))
      ) {
        throw new Error("recipient hash invalid");
      }
      const recorded = await dependencies.repository.recordProviderEvent({
        provider: verified.provider,
        providerEventId: verified.providerEventId,
        eventType: verified.eventType,
        recognized: verified.recognized,
        occurredAt: verified.occurredAt,
        providerMessageId: verified.providerMessageId,
        recipientHash,
        notificationJobId: verified.notificationJobId,
        correlationState: verified.correlationState,
      });
      if (!isRecordedAction(recorded)) throw new Error("provider event result invalid");
      return webhookResponse(200, { ok: true, outcome: recorded.action });
    } catch (error) {
      if (isVerificationError(error)) {
        return webhookResponse(400, { ok: false, error: "invalid_webhook" });
      }
      return webhookResponse(500, { ok: false, error: "webhook_storage_failed" });
    }
  };
}

class WebhookBodyTooLargeError extends Error {}

async function readBoundedRawBody(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAXIMUM_WEBHOOK_BODY_BYTES) {
        await reader.cancel();
        throw new WebhookBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(concatenate(chunks, totalBytes));
  } catch {
    throw new Error("invalid webhook encoding");
  }
}

function concatenate(chunks: readonly Uint8Array[], totalBytes: number) {
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function readDeclaredLength(value: string | null) {
  if (value === null) return "ok" as const;
  if (!/^\d{1,12}$/u.test(value)) return "invalid" as const;
  const length = Number(value);
  if (!Number.isSafeInteger(length)) return "invalid" as const;
  return length > MAXIMUM_WEBHOOK_BODY_BYTES ? "too_large" as const : "ok" as const;
}

function readSignatureHeaders(headers: Headers): TransactionalEmailWebhookHeaders {
  return {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  };
}

function isRecordedAction(value: unknown): value is Awaited<
  ReturnType<TransactionalEmailWebhookRepository["recordProviderEvent"]>
> {
  return typeof value === "object"
    && value !== null
    && "action" in value
    && (value.action === "stored" || value.action === "duplicate" || value.action === "security_review")
    && "deliveryState" in value
    && typeof value.deliveryState === "string";
}

function isVerificationError(error: unknown) {
  return error instanceof Error && (
    error.name === "ResendWebhookVerificationError"
    || error.message.startsWith("RESEND_WEBHOOK_")
  );
}

function webhookResponse(status: number, body: Readonly<Record<string, string | boolean>>) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}
