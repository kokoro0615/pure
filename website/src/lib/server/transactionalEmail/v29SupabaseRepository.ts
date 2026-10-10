import { readTicketCommercialSnapshot } from "../../tickets/ticketCommercialTerms";
import "server-only";

import { decryptCustomerProfileValue } from "../customerProfileCrypto";
import { decryptTicketEntryUrl } from "../tickets/ticketOrderEntryCrypto";
import {
  decryptTicketOtp,
  type TicketAuthKeyring,
} from "../tickets/ticketAuthCrypto";
import type {
  TransactionalEmailOutboxRepository,
  TransactionalEmailClaimResult,
  TransactionalEmailRecordedOutcome,
} from "./outbox";
import type { TransactionalEmailProviderReceipt } from "./provider";
import type { TransactionalEmailRenderCommand } from "./types";
import type {
  TransactionalEmailWebhookRepository,
} from "./webhook";

type RpcResult = Readonly<{ data: unknown; error: unknown }>;
type TransactionalEmailRpcClient = Readonly<{
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}>;

type RepositoryDependencies = Readonly<{
  client: TransactionalEmailRpcClient;
  keyring: TicketAuthKeyring;
  decryptRecipient?: (ciphertext: Buffer) => string;
}>;

type TransactionalEmailV29Repository =
  TransactionalEmailOutboxRepository
  & TransactionalEmailWebhookRepository;

export function createTransactionalEmailV29SupabaseRepository(
  dependencies: RepositoryDependencies,
): TransactionalEmailV29Repository {
  const decryptRecipient = dependencies.decryptRecipient ?? decryptCustomerProfileValue;
  return {
    async claimOne(command) {
      const value = await callJsonRpc(
        dependencies.client,
        "claim_transactional_email_job_v29",
        {
          p_worker_id: command.workerId,
          p_provider_name: command.provider,
          p_lease_seconds: command.leaseSeconds,
          p_maximum_provider_sends_per_second: command.maximumProviderSendsPerSecond,
          p_specific_job_id: command.specificJobId,
        },
      );
      if (
        value.action === "empty"
        || value.action === "cadence_limited"
        || value.action === "circuit_open"
      ) {
        return { action: value.action };
      }
      if (value.action !== "claimed" || !isRecord(value.job)) throw databaseError();
      return readClaimedJob(
        value.job,
        dependencies.keyring,
        decryptRecipient,
      );
    },

    async preparePayload(command) {
      const value = await callJsonRpc(
        dependencies.client,
        "prepare_transactional_email_payload_v29",
        {
          p_job_id: command.jobId,
          p_claim_token: command.claimToken,
          p_payload_hash: command.payloadHash,
        },
      );
      if (
        value.action === "prepared"
        || value.action === "reused"
        || value.action === "conflict"
        || value.action === "stale_claim"
      ) {
        return { action: value.action };
      }
      throw databaseError();
    },

    async recordOutcome(command) {
      const receipt = flattenReceipt(command.receipt);
      const value = await callJsonRpc(
        dependencies.client,
        "mark_transactional_email_job_outcome_v29",
        {
          p_job_id: command.jobId,
          p_claim_token: command.claimToken,
          p_provider_name: command.provider,
          p_payload_hash: command.payloadHash,
          p_outcome: receipt.outcome,
          p_provider_message_id: receipt.providerMessageId,
          p_safe_category: receipt.safeCategory,
          p_retry_after_ms: receipt.retryAfterMs,
        },
      );
      if (
        value.action === "accepted"
        || value.action === "retry"
        || value.action === "dead"
        || value.action === "configuration"
      ) {
        return { action: value.action } satisfies TransactionalEmailRecordedOutcome;
      }
      throw databaseError();
    },

    async recordProviderEvent(command) {
      const value = await callJsonRpc(
        dependencies.client,
        "record_transactional_email_provider_event_v29",
        {
          p_provider_name: command.provider,
          p_provider_event_id: command.providerEventId,
          p_event_type: command.eventType,
          p_recognized: command.recognized,
          p_occurred_at: command.occurredAt,
          p_provider_message_id: command.providerMessageId,
          p_recipient_email_hash: command.recipientHash,
          p_notification_job_id: command.notificationJobId,
          p_correlation_state: command.correlationState,
        },
      );
      if (
        value.action !== "stored"
        && value.action !== "duplicate"
        && value.action !== "security_review"
      ) {
        throw databaseError();
      }
      return {
        action: value.action,
        deliveryState: requireString(value.deliveryState),
      };
    },
  };
}

function readClaimedJob(
  value: Record<string, unknown>,
  keyring: TicketAuthKeyring,
  decryptRecipient: (ciphertext: Buffer) => string,
): Extract<TransactionalEmailClaimResult, { action: "claimed" }> {
  const id = requireString(value.id);
  if (isRecord(value.renderDataJson) && value.renderDataJson.template === "ticket_wallet_purchase") {
    const data = value.renderDataJson;
    if (!["ghost.ticket-wallet-purchase.v1", "ghost.ticket-wallet-purchase.v2"].includes(String(data.templateVersion)) || data.notificationJobId !== id) throw databaseError();
    let recipient: string;
    try { recipient = decryptRecipient(canonicalBase64Buffer(value.recipientCiphertextBase64,1_000_000)); } catch { throw databaseError(); }
    return { action: "claimed", job: {
      id, claimToken:requireString(value.claimToken),attemptCount:requireInteger(value.attemptCount),
      providerIdempotencyKey:requireString(value.providerIdempotencyKey),expectedPayloadHash:nullableString(value.expectedPayloadHash),
      renderCommand:{...(data.commercial == null ? {} : {commercial:readTicketCommercialSnapshot(data.commercial)}),template:"ticket_wallet_purchase",templateVersion:data.templateVersion as "ghost.ticket-wallet-purchase.v1" | "ghost.ticket-wallet-purchase.v2",notificationJobId:id,
        ...(data.templateVersion === "ghost.ticket-wallet-purchase.v2" ? {eventTitle:requireString(data.eventTitle),demoAdmissionTest:data.demoAdmissionTest === true} : {}),recipient,
        renderReferenceAt:canonicalInstant(data.renderReferenceAt),from:requireString(data.from),replyTo:nullableString(data.replyTo),
        walletUrl:requireString(data.walletUrl),publicCode:requireString(data.publicCode),eventDate:requireString(data.eventDate),totalQuantity:requireInteger(data.totalQuantity),
        ...(data.orderEntry == null ? {} : { orderEntryUrl: decryptTicketEntryUrl(keyring, data.orderEntry) })},
    }};
  }
  const challengeId = requireString(value.otpChallengeId);
  const authKeyId = requireString(value.authKeyId);
  if (!keyring.keyFor(authKeyId)) throw databaseError();
  const recipientCiphertext = canonicalBase64Buffer(
    value.recipientCiphertextBase64,
    1_000_000,
  );
  const otpCiphertext = canonicalBase64Buffer(value.otpCiphertextBase64, 8_192);
  verifyOtpEnvelopeKeyId(otpCiphertext, authKeyId);

  let recipient: string;
  let otp: string;
  try {
    recipient = decryptRecipient(recipientCiphertext);
    otp = decryptTicketOtp(keyring, otpCiphertext, challengeId);
  } catch {
    throw databaseError();
  }
  const renderCommand = readRenderCommand(value.renderDataJson, {
    id,
    recipient,
    otp,
  });
  return {
    action: "claimed",
    job: {
      id,
      claimToken: requireString(value.claimToken),
      attemptCount: requireInteger(value.attemptCount),
      providerIdempotencyKey: requireString(value.providerIdempotencyKey),
      expectedPayloadHash: nullableString(value.expectedPayloadHash),
      renderCommand,
    },
  };
}

function readRenderCommand(
  value: unknown,
  ephemeral: Readonly<{ id: string; recipient: string; otp: string }>,
): TransactionalEmailRenderCommand {
  if (!isRecord(value) || value.template !== "ticket_wallet_otp") throw databaseError();
  if (
    value.templateVersion !== "ghost.ticket-wallet-otp.v1"
    || value.notificationJobId !== ephemeral.id
    || !hasExactOtpTags(value.tags, ephemeral.id)
  ) {
    throw databaseError();
  }
  return {
    template: "ticket_wallet_otp",
    templateVersion: "ghost.ticket-wallet-otp.v1",
    notificationJobId: ephemeral.id,
    recipient: ephemeral.recipient,
    otp: ephemeral.otp,
    renderReferenceAt: canonicalInstant(value.renderReferenceAt),
    expiresAt: canonicalInstant(value.expiresAt),
    from: requireString(value.from),
    replyTo: nullableString(value.replyTo),
    walletUrl: requireString(value.walletUrl),
  };
}

function hasExactOtpTags(value: unknown, jobId: string) {
  return Array.isArray(value)
    && value.length === 2
    && isRecord(value[0])
    && value[0].name === "purpose"
    && value[0].value === "ticket_wallet_otp"
    && isRecord(value[1])
    && value[1].name === "notification_job_id"
    && value[1].value === jobId;
}

function flattenReceipt(receipt: TransactionalEmailProviderReceipt) {
  if (receipt.outcome === "accepted") {
    return {
      outcome: receipt.outcome,
      providerMessageId: receipt.providerMessageId,
      safeCategory: "accepted",
      retryAfterMs: null,
    };
  }
  return {
    outcome: receipt.outcome,
    providerMessageId: null,
    safeCategory: receipt.category,
    retryAfterMs: receipt.outcome === "retryable"
      ? receipt.retryAfterMs ?? null
      : null,
  };
}

async function callJsonRpc(
  client: TransactionalEmailRpcClient,
  name: string,
  parameters: Readonly<Record<string, unknown>>,
) {
  let result: RpcResult;
  try {
    result = await client.rpc(name, parameters);
  } catch {
    throw databaseError();
  }
  if (result.error || !isRecord(result.data)) throw databaseError();
  return result.data;
}

function canonicalBase64Buffer(value: unknown, maximumBytes: number) {
  if (typeof value !== "string" || value.length === 0) throw databaseError();
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.length === 0
    || decoded.length > maximumBytes
    || decoded.toString("base64") !== value
  ) {
    throw databaseError();
  }
  return decoded;
}

function verifyOtpEnvelopeKeyId(ciphertext: Buffer, expectedKeyId: string) {
  try {
    const value = JSON.parse(ciphertext.toString("utf8")) as unknown;
    if (!isRecord(value) || value.keyId !== expectedKeyId) throw new Error("key mismatch");
  } catch {
    throw databaseError();
  }
}

function requireString(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  return value;
}

function nullableString(value: unknown) {
  return value === null ? null : requireString(value);
}

function requireInteger(value: unknown) {
  if (!Number.isSafeInteger(value)) throw databaseError();
  return value as number;
}

function canonicalInstant(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw databaseError();
  return new Date(timestamp).toISOString();
}

function databaseError() {
  const error = new Error("TRANSACTIONAL_EMAIL_DATABASE_UNAVAILABLE");
  error.name = "TransactionalEmailDatabaseError";
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
