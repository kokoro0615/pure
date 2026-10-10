import "server-only";

import { randomUUID } from "node:crypto";

import { getTicketWalletReadiness } from "../ticketWalletReadiness";
import { readRuntimeEnvironment } from "../runtimeEnvironment";
import { createSupabaseAdminClient } from "../supabaseAdmin";
import { isGhostVipTrialMode } from "../trialSafety";
import { verifyTurnstileToken } from "../turnstile";
import { runTransactionalEmailOutbox } from "../transactionalEmail/outbox";
import { ResendTransactionalEmailProvider } from "../transactionalEmail/resendProvider";
import {
  inspectResendRuntimeConfiguration,
  requireResendRuntimeConfiguration,
} from "../transactionalEmail/resendRuntimeConfiguration";
import { createTransactionalEmailV29SupabaseRepository } from "../transactionalEmail/v29SupabaseRepository";
import { createTransactionalEmailWebhookHandler } from "../transactionalEmail/webhook";
import {
  hashPurchaserEmail,
  normalizeTicketPurchaserEmail,
} from "./admissionCodes";
import { createTicketAdmissionPublicApi } from "./ticketAdmissionPublicApi";
import { assertTicketCanaryRuntimeAuthority } from "./ticketCanaryRuntimeGuard";
import { readTicketAuthKeyring } from "./ticketAuthCrypto";
import { createTicketWalletPublicApi } from "./ticketWalletPublicApi";
import { createTicketWalletV29SupabaseRepository } from "./ticketWalletV29SupabaseRepository";
import { createTicketWalletV30SupabaseRepository } from "./ticketWalletV30SupabaseRepository";
import { createTicketWalletRouteRuntime } from "./ticketWalletRouteRuntime";
import { runTicketMaintenanceRpc } from "./ticketMaintenanceRpc";

let productionRuntime: ReturnType<typeof createTicketWalletRouteRuntime> | null = null;
let productionEmailRuntime: ReturnType<typeof createEmailRuntime> | null = null;

export function getTicketWalletProductionRouteRuntime() {
  productionRuntime ??= buildProductionRuntime();
  return productionRuntime;
}

function buildProductionRuntime() {
  assertTicketCanaryRuntimeAuthority();
  const keyring = readTicketAuthKeyring();
  const expectedOrigin = readPublicOrigin();
  const environment = readTicketEnvironment();
  const resend = inspectResendRuntimeConfiguration(process.env).configuration;
  const supabase = createSupabaseAdminClient();
  const rpcClient = {
    rpc(name: string, parameters: Readonly<Record<string, unknown>>) {
      return supabase.rpc(name, parameters);
    },
  };
  const v29 = createTicketWalletV29SupabaseRepository(rpcClient);
  const v30 = createTicketWalletV30SupabaseRepository(rpcClient);
  const walletRepository = Object.freeze({
    ...v29,
    readWallet: v30.readWallet,
  });
  const admissionApi = createTicketAdmissionPublicApi({
    repository: v30,
    keyring,
    environment,
    expectedOrigin,
    readiness() {
      const readiness = getTicketWalletReadiness();
      return {
        prepare: readiness.swipePrepare.ok,
        commit: readiness.swipeCommit.ok,
        resultRead: readiness.walletRead.ok,
      };
    },
  });

  return createTicketWalletRouteRuntime({
    createWalletApi(scheduleOtpDelivery) {
      return createTicketWalletPublicApi({
        repository: walletRepository,
        keyring,
        environment,
        expectedOrigin,
        readiness() {
          const readiness = getTicketWalletReadiness();
          return {
            otpDelivery: readiness.otpDelivery,
            walletRead: readiness.walletRead,
          };
        },
        otpDeliverySnapshot: {
          from: resend?.from ?? "",
          replyTo: resend?.replyTo ?? null,
          walletUrl: `${expectedOrigin}/tickets/wallet`,
        },
        verifyTurnstile: (token, request) =>
          verifyTurnstileToken(token, request, {
            expectedHostname: new URL(expectedOrigin).hostname,
          }),
        scheduleOtpDelivery,
      });
    },
    admissionApi,
    async runSpecificEmailJob(jobId) {
      await runTicketTransactionalEmailSpecificJob(jobId);
    },
    async handleWebhook(request) {
      if (!getTicketWalletReadiness().providerWebhook.ok) {
        return providerUnavailableResponse();
      }
      return requireProductionEmailRuntime().webhook(request);
    },
  });
}

export async function runTicketTransactionalEmailDispatcher(budgetMs = 45_000) {
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1_000 || budgetMs > 45_000) throw new Error("invalid_dispatch_budget");
  const deadline = performance.now() + budgetMs + 5_000;
  const { dispatchTransactionalEmail } = await import("../transactionalEmail/dispatcher");
  if (isGhostVipTrialMode() || !getTicketWalletReadiness().transactionalEmailDrain.ok) throw new Error("TICKET_TRANSACTIONAL_EMAIL_DISABLED");
  const configuration = requireResendRuntimeConfiguration(process.env);
  const client = createSupabaseAdminClient();
  await runTicketMaintenanceRpc("materialize_ticket_purchase_notices_v33", signal => client.rpc("materialize_ticket_purchase_notices_v33", {
    p_from:configuration.from,p_reply_to:configuration.replyTo,p_wallet_url:`${readPublicOrigin()}/tickets/wallet`,p_limit:100,
  }).abortSignal(signal), { deadline });
  const { materializeTicketEntryNotices } = await import("./ticketOrderEntryRuntime");
  await materializeTicketEntryNotices({ deadline });
  await runTicketMaintenanceRpc("retire_ticket_purchase_delivery_v38", signal => client.rpc("retire_ticket_purchase_delivery_v38", { p_limit: 100 }).abortSignal(signal), { deadline });
  // Preparation retries consume the same invocation budget. Reserve time for
  // the final heartbeat; never mark success merely because preparation ran.
  const drainBudget = Math.min(budgetMs, Math.floor(deadline - performance.now() - 6_000));
  if (drainBudget < 1_000) throw new Error("TICKET_EMAIL_DISPATCH_BUDGET_EXHAUSTED");
  const result = await dispatchTransactionalEmail({budgetMs:drainBudget,runOne: () => runTicketTransactionalEmailWorker({limit:1,specificJobId:null})});
  const { recordTicketHeartbeat } = await import("./ticketMonitoring");
  await recordTicketHeartbeat("email_dispatcher", result.errors === 0, { deadline });
  return result;
}

export async function runTicketTransactionalEmailRecovery(limit = 10) {
  return runTicketTransactionalEmailWorker({ limit, specificJobId: null });
}

export async function runTicketTransactionalEmailSpecificJob(jobId: string) {
  return runTicketTransactionalEmailWorker({ limit: 1, specificJobId: jobId });
}

export async function runTicketWalletRetentionCleanup(batchLimit = 1_000) {
  if (isGhostVipTrialMode() || !Number.isSafeInteger(batchLimit) || batchLimit < 1 || batchLimit > 10_000) {
    throw new Error("TICKET_WALLET_RETENTION_CLEANUP_DISABLED");
  }
  const { data, error } = await createSupabaseAdminClient().rpc(
    "cleanup_ticket_wallet_auth_email_v29",
    { p_batch_limit: batchLimit },
  );
  if (error || !isRecord(data) || data.action !== "cleaned") {
    throw new Error("TICKET_WALLET_RETENTION_CLEANUP_FAILED");
  }
  const fields = [
    "expiredChallenges",
    "expiredPreauthFlows",
    "expiredSessions",
    "scrubbedChallenges",
    "deletedPreauthFlows",
    "deletedSessions",
    "deletedRateBuckets",
    "deletedProviderEvents",
    "deletedEmailJobs",
    "deletedSuppressions",
  ] as const;
  return Object.freeze(Object.fromEntries([
    ["action", "cleaned"],
    ...fields.map((field) => [field, readCleanupCount(data[field])]),
  ]));
}

async function runTicketTransactionalEmailWorker(input: Readonly<{
  limit: number;
  specificJobId: string | null;
}>) {
  if (isGhostVipTrialMode() || !getTicketWalletReadiness().transactionalEmailDrain.ok) {
    throw new Error("TICKET_TRANSACTIONAL_EMAIL_DISABLED");
  }
  const email = requireProductionEmailRuntime();
  return runTransactionalEmailOutbox({
    repository: email.repository,
    provider: email.provider,
    workerId: randomUUID(),
    specificJobId: input.specificJobId,
    limit: input.limit,
    leaseSeconds: 90,
    providerTimeoutMs: 5_000,
  });
}

function requireProductionEmailRuntime() {
  if (productionEmailRuntime) return productionEmailRuntime;
  const keyring = readTicketAuthKeyring();
  const supabase = createSupabaseAdminClient();
  productionEmailRuntime = createEmailRuntime({
    keyring,
    rpcClient: {
      rpc(name: string, parameters: Readonly<Record<string, unknown>>) {
        return supabase.rpc(name, parameters);
      },
    },
  });
  return productionEmailRuntime;
}

function createEmailRuntime(input: Readonly<{
  keyring: ReturnType<typeof readTicketAuthKeyring>;
  rpcClient: Parameters<typeof createTransactionalEmailV29SupabaseRepository>[0]["client"];
}>) {
  const repository = createTransactionalEmailV29SupabaseRepository({
    client: input.rpcClient,
    keyring: input.keyring,
  });
  const configuration = requireResendRuntimeConfiguration(process.env);
  const provider = new ResendTransactionalEmailProvider({
    apiKey: configuration.apiKey,
    webhookSecrets: configuration.webhookSecrets,
  });
  const webhook = createTransactionalEmailWebhookHandler({
    verifier: provider,
    repository,
    hashRecipient(recipient) {
      const normalized = normalizeTicketPurchaserEmail(recipient);
      const hash = normalized ? hashPurchaserEmail(normalized) : null;
      if (!hash) throw new Error("recipient_identity_invalid");
      return hash;
    },
  });
  return Object.freeze({ repository, provider, webhook });
}

export function readTicketEnvironment() {
  return readRuntimeEnvironment();
}

export function readPublicOrigin() {
  const canaryAuthority = assertTicketCanaryRuntimeAuthority();
  const origin = canaryAuthority.enabled
    ? canaryAuthority.publicOrigin
    : requireConfiguration("TICKET_WALLET_PUBLIC_ORIGIN").replace(/\/$/u, "");
  const url = new URL(origin);
  if (
    url.protocol !== "https:"
    || url.origin !== origin
    || url.pathname !== "/"
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("TICKET_WALLET_PUBLIC_ORIGIN_INVALID");
  }
  return origin;
}

function requireConfiguration(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value.length > 4_096 || /[\r\n\0]/u.test(value)) {
    throw new Error("TICKET_WALLET_RUNTIME_NOT_CONFIGURED");
  }
  return value;
}

function providerUnavailableResponse() {
  return Response.json({ ok: false, error: "feature_unavailable" }, {
    status: 503,
    headers: {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function readCleanupCount(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("TICKET_WALLET_RETENTION_CLEANUP_FAILED");
  }
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
