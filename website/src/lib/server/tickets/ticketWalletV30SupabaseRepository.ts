import "server-only";

import type {
  TicketAdmissionPreparedResult,
  TicketAdmissionPublicRepository,
  TicketAdmissionReadinessResult,
  TicketAdmissionResult,
} from "./ticketAdmissionPublicApi";
import type {
  TicketWalletPublicRepository,
  TicketWalletViewResult,
} from "./ticketWalletPublicApi";

type RpcResult = Readonly<{ data: unknown; error: unknown }>;
type TicketWalletRpcClient = Readonly<{
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}>;

type TicketWalletV30Repository =
  Pick<TicketWalletPublicRepository, "readWallet">
  & TicketAdmissionPublicRepository;
type PreparedFailure = Readonly<{
  action: "unauthenticated" | "conflict" | "rejected";
  reason?: string;
}>;
type ResultFailure = Readonly<{
  action: "unauthenticated" | "not_found" | "conflict" | "rejected";
  reason?: string;
}>;

export class TicketWalletDatabaseError extends Error {
  constructor() {
    super("TICKET_WALLET_DATABASE_UNAVAILABLE");
    this.name = "TicketWalletDatabaseError";
  }
}

export function createTicketWalletV30SupabaseRepository(
  client: TicketWalletRpcClient,
): TicketWalletV30Repository {
  return {
    async readWallet(command) {
      const value = await callJsonRpc(client, "read_ticket_wallet_v30", {
        p_environment: command.environment,
        p_wallet_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
      });
      if (value.action === "unauthenticated") return { action: "unauthenticated" };
      if (value.action !== "read" || !Array.isArray(value.events)) throw databaseError();
      return {
        action: "loaded",
        serverNow: canonicalInstant(value.serverNow),
        events: canonicalWalletEvents(value.events),
      };
    },

    async readReadiness(command) {
      const value = await callJsonRpc(client, "read_ticket_admission_readiness_v30", {
        p_environment: command.environment,
        p_wallet_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_event_session_id: command.eventSessionId,
      });
      if (value.action === "unauthenticated") return { action: "unauthenticated" };
      if (value.action !== "read") throw databaseError();
      const state = requireSet(value.state, [
        "not_open",
        "open",
        "closed",
        "fresh_auth_required",
        "feature_unavailable",
        "manager_recovery",
      ] as const);
      return {
        action: "read",
        state,
        serverNow: canonicalInstant(value.serverNow),
        eventSessionId: nullableString(value.eventSessionId),
        opensAt: nullableInstant(value.opensAt),
        closesAt: nullableInstant(value.closesAt),
        maximumSelection: requireInteger(value.maximumSelection),
      } satisfies TicketAdmissionReadinessResult;
    },

    async prepare(command) {
      const value = await callJsonRpc(client, "prepare_ticket_admission_v30", {
        p_environment: command.environment,
        p_wallet_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_prepare_idempotency_key_hash: command.prepareIdempotencyKeyHash,
        p_request_hash: command.requestHash,
        p_admission_ids: [...command.admissionIds],
        p_challenge_token_verifier: command.challengeTokenVerifier,
      });
      if (value.action === "result") return readAdmissionResult(value);
      if (value.action === "prepared" || value.action === "reused") {
        return {
          action: value.action,
          operationId: requireString(value.operationId),
          eventSessionId: requireString(value.eventSessionId),
          eventTitle: requireString(value.eventTitle),
          eventDate: requireString(value.eventDate),
          selectedCount: requireInteger(value.selectedCount),
          challengeExpiresAt: canonicalInstant(value.challengeExpiresAt),
          serverNow: canonicalInstant(value.serverNow),
          expectedVersion: requireInteger(value.expectedVersion ?? value.operationVersion),
        } satisfies TicketAdmissionPreparedResult;
      }
      return readAdmissionFailure(value, false);
    },

    async commit(command) {
      const value = await callJsonRpc(client, "commit_ticket_admission_v30", {
        p_environment: command.environment,
        p_wallet_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_operation_id: command.operationId,
        p_commit_idempotency_key_hash: command.commitIdempotencyKeyHash,
        p_commit_request_hash: command.commitRequestHash,
        p_challenge_token_verifier: command.challengeTokenVerifier,
      });
      return value.action === "result"
        ? readAdmissionResult(value)
        : readAdmissionFailure(value, true);
    },

    async readResult(command) {
      const value = await callJsonRpc(client, "read_ticket_admission_result_v30", {
        p_environment: command.environment,
        p_wallet_session_id: command.session.sessionId,
        p_session_token_verifier: command.session.tokenVerifier,
        p_operation_id: command.operationId,
      });
      return value.action === "result"
        ? readAdmissionResult(value)
        : readAdmissionFailure(value, true);
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

function readAdmissionResult(value: Record<string, unknown>): Extract<
  TicketAdmissionResult,
  { action: "result" }
> {
  const databaseState = requireSet(value.state, [
    "pending",
    "committed",
    "rejected",
    "expired",
  ] as const);
  const state = databaseState === "committed"
    ? value.reused === true ? "already_committed" : "committed"
    : databaseState === "pending" ? "pending" : "rejected";
  const errorCode = databaseState === "expired"
    ? "challenge_expired"
    : optionalString(value.errorCode);
  return {
    action: "result",
    operationId: requireString(value.operationId),
    state,
    eventTitle: requireString(value.eventTitle),
    eventDate: requireString(value.eventDate),
    admittedCount: requireInteger(value.admittedCount),
    admittedAt: nullableInstant(value.admittedAt),
    serverNow: canonicalInstant(value.serverNow),
    ...(errorCode ? { errorCode } : {}),
  };
}

function readAdmissionFailure(
  value: Record<string, unknown>,
  allowNotFound: false,
): PreparedFailure;
function readAdmissionFailure(
  value: Record<string, unknown>,
  allowNotFound: true,
): ResultFailure;
function readAdmissionFailure(
  value: Record<string, unknown>,
  allowNotFound: boolean,
): PreparedFailure | ResultFailure {
  if (value.action === "unauthenticated") return { action: "unauthenticated" };
  if (allowNotFound && value.action === "not_found") return { action: "not_found" };
  if (value.action === "conflict") {
    return { action: "conflict", ...(optionalString(value.reason) ? { reason: optionalString(value.reason) } : {}) };
  }
  if (value.action === "rejected") {
    return { action: "rejected", ...(optionalString(value.reason) ? { reason: optionalString(value.reason) } : {}) };
  }
  throw databaseError();
}

function requireString(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown) {
  if (value === null) return null;
  return requireString(value);
}

function nullableInstant(value: unknown) {
  return value === null ? null : canonicalInstant(value);
}

function canonicalInstant(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw databaseError();
  return new Date(timestamp).toISOString();
}

function canonicalWalletEvents(value: unknown): Extract<
  TicketWalletViewResult,
  { action: "loaded" }
>["events"] {
  if (!Array.isArray(value)) throw databaseError();
  return value.map((event) => {
    if (!isRecord(event) || !Array.isArray(event.admissions)) throw databaseError();
    return {
      eventSessionId: requireString(event.eventSessionId),
      eventTitle: requireString(event.eventTitle),
      eventDate: requireString(event.eventDate),
      doorsAt: canonicalInstant(event.doorsAt),
      admissionOpensAt: canonicalInstant(event.admissionOpensAt),
      admissionClosesAt: canonicalInstant(event.admissionClosesAt),
      ...(event.demoAdmissionTest === true ? {demoAdmissionTest:true} : {}),
      admissions: event.admissions.map((admission) => {
        if (!isRecord(admission)) throw databaseError();
        return {
          admissionId: requireString(admission.admissionId),
          eventSessionId: requireString(admission.eventSessionId),
          selectionGroupId: requireString(admission.selectionGroupId),
          ...(admission.admissionPolicy === undefined ? {} : { admissionPolicy: admission.admissionPolicy === "order_together_v1" ? "order_together_v1" as const : admission.admissionPolicy === "individual_v1" ? "individual_v1" as const : (() => { throw new Error("wallet_admission_policy_invalid"); })() }),
          serial: requireInteger(admission.serial),
          label: requireString(admission.label),
          status: requireSet(admission.status, [
            "issued",
            "admitted",
            "void",
            "refunded",
            "disputed",
          ] as const),
          admittedAt: nullableInstant(admission.admittedAt),
        };
      }),
    };
  });
}

function requireInteger(value: unknown) {
  if (!Number.isSafeInteger(value)) throw databaseError();
  return value as number;
}

function requireSet<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) throw databaseError();
  return value as Values[number];
}

function databaseError() {
  return new TicketWalletDatabaseError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
