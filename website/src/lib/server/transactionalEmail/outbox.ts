import "server-only";

import { renderTransactionalEmail } from "./renderer";
import type {
  TransactionalEmailProviderPort,
  TransactionalEmailProviderReceipt,
} from "./provider";
import type { TransactionalEmailRenderCommand } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:/-]{1,256}$/u;
const MAXIMUM_PROVIDER_SENDS_PER_SECOND = 4 as const;
const DEFAULT_LEASE_SECONDS = 300;
const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;
const MAXIMUM_BATCH_SIZE = 25;

export type ClaimedTransactionalEmailJob = Readonly<{
  id: string;
  claimToken: string;
  attemptCount: number;
  providerIdempotencyKey: string;
  expectedPayloadHash: string | null;
  /** Ephemeral decrypted material. Implementations must never persist this object. */
  renderCommand: TransactionalEmailRenderCommand;
}>;

export type TransactionalEmailClaimResult =
  | Readonly<{ action: "claimed"; job: ClaimedTransactionalEmailJob }>
  | Readonly<{ action: "empty" }>
  | Readonly<{ action: "cadence_limited" }>
  | Readonly<{ action: "circuit_open" }>;

export type TransactionalEmailRecordedOutcome = Readonly<{
  action: "accepted" | "retry" | "dead" | "configuration";
}>;

export interface TransactionalEmailOutboxRepository {
  claimOne(command: Readonly<{
    workerId: string;
    provider: TransactionalEmailProviderPort["providerName"];
    leaseSeconds: number;
    maximumProviderSendsPerSecond: typeof MAXIMUM_PROVIDER_SENDS_PER_SECOND;
    specificJobId: string | null;
  }>): Promise<TransactionalEmailClaimResult>;
  preparePayload(command: Readonly<{
    jobId: string;
    claimToken: string;
    payloadHash: string;
  }>): Promise<Readonly<{
    action: "prepared" | "reused" | "conflict" | "stale_claim";
  }>>;
  recordOutcome(command: Readonly<{
    jobId: string;
    claimToken: string;
    provider: TransactionalEmailProviderPort["providerName"];
    payloadHash: string;
    receipt: TransactionalEmailProviderReceipt;
  }>): Promise<TransactionalEmailRecordedOutcome>;
}

export class TransactionalEmailOutboxError extends Error {
  readonly code:
    | "TRANSACTIONAL_EMAIL_OUTBOX_INVALID_REQUEST"
    | "TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_FAILED"
    | "TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_INVALID"
    | "TRANSACTIONAL_EMAIL_OUTBOX_MARK_FAILED"
    | "TRANSACTIONAL_EMAIL_OUTBOX_MARK_INVALID";

  constructor(code: TransactionalEmailOutboxError["code"]) {
    super(code);
    this.name = "TransactionalEmailOutboxError";
    this.code = code;
  }
}

export async function runTransactionalEmailOutbox(input: Readonly<{
  repository: TransactionalEmailOutboxRepository;
  provider: TransactionalEmailProviderPort;
  workerId: string;
  limit?: number;
  leaseSeconds?: number;
  providerTimeoutMs?: number;
  specificJobId?: string | null;
}>) {
  const limit = input.limit ?? 10;
  const leaseSeconds = input.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
  const providerTimeoutMs = input.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const specificJobId = input.specificJobId ?? null;
  validateRunRequest({
    workerId: input.workerId,
    limit,
    leaseSeconds,
    providerTimeoutMs,
    specificJobId,
  });

  const summary = {
    claimed: 0,
    accepted: 0,
    retry: 0,
    dead: 0,
    configuration: 0,
    cadenceLimited: false,
    circuitOpen: false,
  };

  for (let index = 0; index < limit; index += 1) {
    let claim: TransactionalEmailClaimResult;
    try {
      claim = await input.repository.claimOne({
        workerId: input.workerId,
        provider: input.provider.providerName,
        leaseSeconds,
        maximumProviderSendsPerSecond: MAXIMUM_PROVIDER_SENDS_PER_SECOND,
        specificJobId,
      });
    } catch {
      throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_FAILED");
    }

    if (!isClaimResult(claim)) {
      throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_INVALID");
    }
    if (claim.action === "empty") break;
    if (claim.action === "cadence_limited") {
      summary.cadenceLimited = true;
      break;
    }
    if (claim.action === "circuit_open") {
      summary.circuitOpen = true;
      break;
    }
    if (claim.action !== "claimed") {
      throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_INVALID");
    }

    const job = claim.job;
    validateClaimedJob(job);
    summary.claimed += 1;
    const rendered = safelyRender(job);
    const immutableHashMatches = job.expectedPayloadHash === null
      || rendered.payloadHash === job.expectedPayloadHash;
    let prepared = false;
    if (immutableHashMatches) {
      let preparation: Awaited<ReturnType<TransactionalEmailOutboxRepository["preparePayload"]>>;
      try {
        preparation = await input.repository.preparePayload({
          jobId: job.id,
          claimToken: job.claimToken,
          payloadHash: rendered.payloadHash,
        });
      } catch {
        throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_MARK_FAILED");
      }
      if (!isPayloadPreparation(preparation)) {
        throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_MARK_INVALID");
      }
      if (preparation.action === "stale_claim") {
        throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_MARK_FAILED");
      }
      prepared = preparation.action === "prepared" || preparation.action === "reused";
    }
    const receipt = immutableHashMatches && prepared
      ? await safelySend(input.provider, rendered, job.providerIdempotencyKey, providerTimeoutMs)
      : configurationPayloadMismatch();
    let recorded: TransactionalEmailRecordedOutcome;
    try {
      recorded = await input.repository.recordOutcome({
        jobId: job.id,
        claimToken: job.claimToken,
        provider: input.provider.providerName,
        payloadHash: rendered.payloadHash,
        receipt,
      });
    } catch {
      // The lease is intentionally left for stale-claim recovery. A replay uses the
      // same immutable payload and provider idempotency key.
      throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_MARK_FAILED");
    }
    if (!isRecordedOutcome(recorded)) {
      throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_MARK_INVALID");
    }
    summary[recorded.action] += 1;
    if (recorded.action === "configuration") {
      summary.circuitOpen = true;
      break;
    }
    if (specificJobId !== null) break;
  }

  return Object.freeze(summary);
}

function safelyRender(job: ClaimedTransactionalEmailJob) {
  try {
    const rendered = renderTransactionalEmail(job.renderCommand);
    const correlatedJobTag = rendered.message.tags.find(
      (tag) => tag.name === "notification_job_id",
    );
    if (correlatedJobTag?.value !== job.id) {
      throw new Error("correlation mismatch");
    }
    return rendered;
  } catch {
    throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_INVALID");
  }
}

async function safelySend(
  provider: TransactionalEmailProviderPort,
  rendered: ReturnType<typeof renderTransactionalEmail>,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<TransactionalEmailProviderReceipt> {
  try {
    const receipt = await provider.send(rendered, { idempotencyKey, timeoutMs });
    return isProviderReceipt(receipt)
      ? receipt
      : Object.freeze({ outcome: "retryable", category: "invalid_provider_response" });
  } catch {
    return Object.freeze({ outcome: "retryable", category: "unknown" });
  }
}

function configurationPayloadMismatch(): TransactionalEmailProviderReceipt {
  return Object.freeze({
    outcome: "configuration",
    category: "payload_hash_mismatch",
  });
}

function validateRunRequest(input: Readonly<{
  workerId: string;
  limit: number;
  leaseSeconds: number;
  providerTimeoutMs: number;
  specificJobId: string | null;
}>) {
  if (
    !UUID_PATTERN.test(input.workerId)
    || !Number.isSafeInteger(input.limit)
    || input.limit < 1
    || input.limit > MAXIMUM_BATCH_SIZE
    || !Number.isSafeInteger(input.leaseSeconds)
    || input.leaseSeconds < 30
    || input.leaseSeconds > 3_600
    || !Number.isSafeInteger(input.providerTimeoutMs)
    || input.providerTimeoutMs < 100
    || input.providerTimeoutMs > 30_000
    || (input.specificJobId !== null && !UUID_PATTERN.test(input.specificJobId))
  ) {
    throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_INVALID_REQUEST");
  }
}

function validateClaimedJob(job: ClaimedTransactionalEmailJob) {
  if (
    !isRecord(job)
    || !UUID_PATTERN.test(job.id)
    || !UUID_PATTERN.test(job.claimToken)
    || !Number.isSafeInteger(job.attemptCount)
    || job.attemptCount < 1
    || job.attemptCount > 100
    || !IDEMPOTENCY_KEY_PATTERN.test(job.providerIdempotencyKey)
    || (job.expectedPayloadHash !== null && !SHA256_PATTERN.test(job.expectedPayloadHash))
    || !isRecord(job.renderCommand)
  ) {
    throw new TransactionalEmailOutboxError("TRANSACTIONAL_EMAIL_OUTBOX_CLAIM_INVALID");
  }
}

function isPayloadPreparation(value: unknown): value is Awaited<
  ReturnType<TransactionalEmailOutboxRepository["preparePayload"]>
> {
  return isRecord(value)
    && (value.action === "prepared"
      || value.action === "reused"
      || value.action === "conflict"
      || value.action === "stale_claim");
}

function isClaimResult(value: unknown): value is TransactionalEmailClaimResult {
  if (!isRecord(value) || typeof value.action !== "string") return false;
  if (value.action === "claimed") return isRecord(value.job);
  return value.action === "empty"
    || value.action === "cadence_limited"
    || value.action === "circuit_open";
}

function isRecordedOutcome(value: unknown): value is TransactionalEmailRecordedOutcome {
  return isRecord(value)
    && (value.action === "accepted"
      || value.action === "retry"
      || value.action === "dead"
      || value.action === "configuration");
}

function isProviderReceipt(value: unknown): value is TransactionalEmailProviderReceipt {
  if (!isRecord(value) || typeof value.outcome !== "string") return false;
  if (value.outcome === "accepted") {
    return typeof value.providerMessageId === "string"
      && value.providerMessageId.length > 0
      && value.providerMessageId.length <= 256
      && !/[\r\n\0]/u.test(value.providerMessageId);
  }
  if (value.outcome !== "retryable" && value.outcome !== "permanent" && value.outcome !== "configuration") {
    return false;
  }
  return typeof value.category === "string"
    && value.category.length > 0
    && value.category.length <= 80
    && (value.retryAfterMs === undefined
      || (value.outcome === "retryable"
        && typeof value.retryAfterMs === "number"
        && Number.isSafeInteger(value.retryAfterMs)
        && value.retryAfterMs >= 0
        && value.retryAfterMs <= 86_400_000));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
