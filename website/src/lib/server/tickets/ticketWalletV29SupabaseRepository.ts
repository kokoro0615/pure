import "server-only";

import type {
  RequestTicketWalletOtpResult,
  TicketWalletPublicRepository,
  TicketWalletSessionResult,
  VerifyTicketWalletOtpResult,
} from "./ticketWalletPublicApi";

type RpcResult = Readonly<{ data: unknown; error: unknown }>;
type TicketWalletRpcClient = Readonly<{
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}>;
type TicketWalletV29Repository = Omit<TicketWalletPublicRepository, "readWallet">;

export function createTicketWalletV29SupabaseRepository(
  client: TicketWalletRpcClient,
): TicketWalletV29Repository {
  return {
    async bootstrapPreAuth(command) {
      const value = await callJsonRpc(client, "bootstrap_ticket_wallet_preauth_v29", {
        p_now: command.now,
        p_presented_flow_id: command.presented?.flowId ?? null,
        p_presented_token_verifier: command.presented?.tokenVerifier ?? null,
        p_candidate_flow_id: command.candidate.flowId,
        p_candidate_token_verifier: command.candidate.tokenVerifier,
        p_candidate_csrf_verifier: command.candidate.csrfVerifier,
        p_candidate_expires_at: command.candidate.expiresAt,
        p_abuse_ip_hash: command.abuseIpHash,
        p_abuse_user_agent_hash: command.abuseUserAgentHash,
        p_minimum_remaining_seconds: command.minimumRemainingSeconds,
        p_ip_window_seconds: command.rateLimitPolicy.ipWindowSeconds,
        p_ip_maximum: command.rateLimitPolicy.ipMaximum,
        p_global_window_seconds: command.rateLimitPolicy.globalWindowSeconds,
        p_global_maximum: command.rateLimitPolicy.globalMaximum,
      });
      if (value.action === "created" || value.action === "rotated" || value.action === "reused") {
        return {
          action: value.action,
          flowId: requireString(value.flowId),
          expiresAt: canonicalInstant(value.expiresAt),
        };
      }
      if (value.action === "rate_limited" || value.action === "rejected") {
        return { action: value.action };
      }
      throw databaseError();
    },

    async requestOtp(command) {
      const value = await callJsonRpc(client, "request_ticket_wallet_otp_v33", {
        p_environment: command.environment,
        p_now: command.now,
        p_preauth_flow_id: command.preAuth.flowId,
        p_preauth_token_verifier: command.preAuth.tokenVerifier,
        p_preauth_csrf_verifier: command.preAuth.csrfVerifier,
        p_identity_email_hash: command.identityEmailHash,
        p_abuse_email_hash: command.abuseEmailHash,
        p_abuse_ip_hash: command.abuseIpHash,
        p_abuse_user_agent_hash: command.abuseUserAgentHash,
        p_candidate_challenge_id: command.candidate.challengeId,
        p_candidate_code_verifier: command.candidate.codeVerifier,
        p_candidate_code_ciphertext: bytea(command.candidate.codeCiphertext),
        p_candidate_expires_at: command.candidate.expiresAt,
        p_candidate_resend_at: command.candidate.resendAvailableAt,
        p_maximum_attempts: command.candidate.maximumAttempts,
        p_provider_idempotency_key: command.candidate.providerIdempotencyKey,
        p_minimum_preauth_remaining_seconds: command.minimumPreAuthRemainingSeconds,
        p_minimum_resend_remaining_seconds: command.minimumResendRemainingSeconds,
        p_email_per_minute: command.rateLimitPolicy.emailPerMinute,
        p_email_per_hour: command.rateLimitPolicy.emailPerHour,
        p_email_per_day: command.rateLimitPolicy.emailPerDay,
        p_ip_per_ten_minutes: command.rateLimitPolicy.ipPerTenMinutes,
        p_ip_per_day: command.rateLimitPolicy.ipPerDay,
        p_preauth_per_ten_minutes: command.rateLimitPolicy.preAuthPerTenMinutes,
        p_global_per_ten_minutes: command.rateLimitPolicy.globalPerTenMinutes,
        p_global_per_day: command.rateLimitPolicy.globalPerDay,
        p_template_version: command.candidate.delivery.templateVersion,
        p_from_address: command.candidate.delivery.from,
        p_reply_to: command.candidate.delivery.replyTo,
        p_wallet_url: command.candidate.delivery.walletUrl,
      });
      if (value.action === "accepted") {
        return {
          action: "accepted",
          challengeId: requireString(value.challengeId),
          expiresAt: canonicalInstant(value.expiresAt),
          resendAvailableAt: canonicalInstant(value.resendAvailableAt),
          attemptsRemaining: requireInteger(value.attemptsRemaining),
          deliveryJobId: nullableString(value.deliveryJobId),
        } satisfies RequestTicketWalletOtpResult;
      }
      if ([
        "preauth_refresh_required",
        "rate_limited",
        "restart_required",
        "rejected",
      ].includes(String(value.action))) {
        return { action: value.action } as RequestTicketWalletOtpResult;
      }
      throw databaseError();
    },

    async verifyOtp(command) {
      const value = await callJsonRpc(client, "verify_ticket_wallet_otp_v29", {
        p_environment: command.environment,
        p_now: command.now,
        p_preauth_flow_id: command.preAuth.flowId,
        p_preauth_token_verifier: command.preAuth.tokenVerifier,
        p_preauth_csrf_verifier: command.preAuth.csrfVerifier,
        p_submitted_code_verifier: command.submittedCodeVerifier,
        p_abuse_ip_hash: command.abuseIpHash,
        p_candidate_session_id: command.candidate.sessionId,
        p_candidate_session_token_verifier: command.candidate.sessionTokenVerifier,
        p_candidate_session_csrf_verifier: command.candidate.sessionCsrfVerifier,
        p_candidate_key_id: command.candidate.keyId,
        p_candidate_fresh_until: command.candidate.freshUntil,
        p_candidate_maximum_expires_at: command.candidate.maximumExpiresAt,
        p_maximum_active_sessions: command.candidate.maximumActiveSessions,
      });
      if (value.action === "verified") {
        return {
          action: "verified",
          sessionId: requireString(value.sessionId),
          verifiedAt: canonicalInstant(value.verifiedAt),
          freshUntil: canonicalInstant(value.freshUntil),
          expiresAt: canonicalInstant(value.expiresAt),
        } satisfies VerifyTicketWalletOtpResult;
      }
      if (value.action !== "rejected") throw databaseError();
      const reason = requireSet(value.reason, [
        "invalid_code",
        "attempts_exhausted",
        "challenge_expired",
        "preauth_invalid",
        "rate_limited",
      ] as const);
      return {
        action: "rejected",
        reason,
        ...(Number.isSafeInteger(value.attemptsRemaining)
          ? { attemptsRemaining: value.attemptsRemaining as number }
          : {}),
      } satisfies VerifyTicketWalletOtpResult;
    },

    async readSession(command) {
      const value = await callJsonRpc(client, "read_ticket_wallet_session_v29", {
        p_environment: command.environment,
        p_now: command.now,
        p_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_session_csrf_verifier: command.session.csrfVerifier,
      });
      if (value.action === "unauthenticated") return { action: "unauthenticated" };
      if (value.action !== "authenticated") throw databaseError();
      return {
        action: "authenticated",
        sessionId: requireString(value.sessionId),
        expiresAt: canonicalInstant(value.expiresAt),
        freshUntil: canonicalInstant(value.freshUntil),
      } satisfies TicketWalletSessionResult;
    },

    async revokeSession(command) {
      const value = await callJsonRpc(client, "revoke_ticket_wallet_session_v29", {
        p_environment: command.environment,
        p_now: command.now,
        p_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_session_csrf_verifier: command.session.csrfVerifier,
        p_reason: command.reason,
      });
      if (value.action === "revoked" || value.action === "reused" || value.action === "unauthenticated") {
        return { action: value.action };
      }
      throw databaseError();
    },
  };
}

async function callJsonRpc(
  client: TicketWalletRpcClient,
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

function bytea(value: Buffer) {
  if (!Buffer.isBuffer(value) || value.length === 0 || value.length > 8_192) {
    throw databaseError();
  }
  return `\\x${value.toString("hex")}`;
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

function requireSet<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    throw databaseError();
  }
  return value as Values[number];
}

function databaseError() {
  const error = new Error("TICKET_WALLET_DATABASE_UNAVAILABLE");
  error.name = "TicketWalletDatabaseError";
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
