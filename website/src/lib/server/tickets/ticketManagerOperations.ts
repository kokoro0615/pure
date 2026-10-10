import "server-only";

import { createHash } from "node:crypto";

import { readBoundedJsonObject } from "./ticketWalletHttp";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PUBLIC_CODE_PATTERN = /^GT-[0-9A-HJ-NP-Z]{10}$/u;
const MAXIMUM_BODY_BYTES = 8_192;

export type TicketOperationScope = "all" | "refund";
export type TicketEnvironment = "live" | "test";
export type TicketManagerFailureCode =
  | "capability_disabled"
  | "invalid_request"
  | "not_found"
  | "version_conflict"
  | "outside_admission_window"
  | "payment_not_settled"
  | "ticket_refunded"
  | "wrong_environment"
  | "provider_disabled"
  | "terminal_state"
  | "operation_failed";

export type TicketOperationMutationResponse = Readonly<{
  ok: true;
  action: "session_revoke" | "assisted_admission" | "refund_resolve" | "email_retry" | TicketEntryRecoveryAction;
  entityVersion: number;
  auditLogId: string;
  reused: boolean;
  serverNow: string;
}>;

export type TicketManagerFailure = Readonly<{
  ok: false;
  error: TicketManagerFailureCode;
  currentVersion: number | null;
  recovery: string | null;
}>;

export type TicketSessionRevokeCommand = Readonly<{
  action: "session_revoke";
  orderPublicCode: string;
  sessionId: string;
  expectedVersion: number;
  reason: string;
}>;

export type TicketAssistedAdmissionCommand = Readonly<{
  action: "assisted_admission";
  orderPublicCode: string;
  environment: TicketEnvironment;
  eventSessionId: string;
  admissionIds: readonly string[];
  expectedVersion: number;
  reason: string;
}>;

export type TicketRefundResolveCommand = Readonly<{
  action: "refund_resolve";
  reviewId: string;
  resolution: "apply_and_void" | "record_admitted_exception" | "dismiss_no_money_moved";
  allocations: readonly Readonly<{ admissionId: string; amountMinor: number }>[];
  expectedVersion: number;
  observationVersion: number;
  observationHash: string;
  reason: string;
}>;

export type TicketEmailRetryCommand = Readonly<{
  action: "email_retry";
  emailJobId: string;
  issueRecoveryMail: boolean;
  expectedVersion: number;
  reason: string;
}>;

export type TicketManagerCommand =
  | TicketEntryRecoveryCommand
  | TicketSessionRevokeCommand
  | TicketAssistedAdmissionCommand
  | TicketRefundResolveCommand
  | TicketEmailRetryCommand;

export type TicketEntryRecoveryAction = "entry_rotate" | "entry_revoke" | "entry_resend" | "entry_exception";
export type TicketEntryRecoveryCommand = Readonly<{
  action: TicketEntryRecoveryAction; orderPublicCode: string; environment: TicketEnvironment;
  expectedVersion: number; expectedGeneration: number | null; reason: string;
  originalOperationId: string | null; guestCount: number | null; confirmation: string | null;
}>;

export type TicketManagerMutationContext = Readonly<{
  actorAdminId: string;
  requestId: string;
  idempotencyKey: string;
  requestHash: string;
}>;

export type TicketManagerRpcResult = Readonly<Record<string, unknown>>;

export interface TicketManagerRepository<QueueResponse, OrderResponse> {
  recoverEntry(context: TicketManagerMutationContext, command: TicketEntryRecoveryCommand): Promise<TicketManagerRpcResult>;
  readQueue(scope: TicketOperationScope): Promise<QueueResponse>;
  readOrder(publicCode: string, scope: TicketOperationScope): Promise<OrderResponse | null>;
  revokeSession(
    context: TicketManagerMutationContext,
    command: TicketSessionRevokeCommand,
  ): Promise<TicketManagerRpcResult>;
  assistAdmission(
    context: TicketManagerMutationContext,
    command: TicketAssistedAdmissionCommand,
  ): Promise<TicketManagerRpcResult>;
  resolveRefund(
    context: TicketManagerMutationContext,
    command: TicketRefundResolveCommand,
  ): Promise<TicketManagerRpcResult>;
  retryEmail(
    context: TicketManagerMutationContext,
    command: TicketEmailRetryCommand,
  ): Promise<TicketManagerRpcResult>;
}

export function readTicketManagerCapabilities(input: Readonly<{
  managerFlagEnabled: boolean;
  refundFlagEnabled: boolean;
  managerReady: boolean;
  refundReady: boolean;
  now?: () => number;
}>) {
  const observedAt = (input.now ?? Date.now)();
  if (!Number.isFinite(observedAt)) throw new Error("TICKET_MANAGER_CLOCK_INVALID");
  return Object.freeze({
    ok: true as const,
    serverNow: new Date(observedAt).toISOString(),
    capabilities: Object.freeze({
      managerOperationsEnabled: input.managerFlagEnabled,
      refundReviewEnabled: input.refundFlagEnabled,
    }),
    readiness: Object.freeze({
      managerOperations: capabilityState(input.managerFlagEnabled, input.managerReady),
      refundReview: capabilityState(input.refundFlagEnabled, input.refundReady),
    }),
  });
}

export function createTicketManagerOperations<QueueResponse, OrderResponse>(
  repository: TicketManagerRepository<QueueResponse, OrderResponse>,
  now: () => number = Date.now,
) {
  return {
    recoverEntry(context: Omit<TicketManagerMutationContext, "requestHash">, command: TicketEntryRecoveryCommand) {
      return executeMutation(command.action, repository.recoverEntry.bind(repository), context, command, now);
    },
    readQueue(scope: TicketOperationScope) {
      return repository.readQueue(scope);
    },
    readOrder(publicCode: string, scope: TicketOperationScope) {
      if (!PUBLIC_CODE_PATTERN.test(publicCode)) throw new TicketManagerRequestError();
      return repository.readOrder(publicCode, scope);
    },
    revokeSession(context: Omit<TicketManagerMutationContext, "requestHash">, command: TicketSessionRevokeCommand) {
      return executeMutation("session_revoke", repository.revokeSession.bind(repository), context, command, now);
    },
    assistAdmission(context: Omit<TicketManagerMutationContext, "requestHash">, command: TicketAssistedAdmissionCommand) {
      return executeMutation("assisted_admission", repository.assistAdmission.bind(repository), context, command, now);
    },
    resolveRefund(context: Omit<TicketManagerMutationContext, "requestHash">, command: TicketRefundResolveCommand) {
      return executeMutation("refund_resolve", repository.resolveRefund.bind(repository), context, command, now);
    },
    retryEmail(context: Omit<TicketManagerMutationContext, "requestHash">, command: TicketEmailRetryCommand) {
      return executeMutation("email_retry", repository.retryEmail.bind(repository), context, command, now);
    },
  };
}

export async function readTicketManagerCommand<Action extends TicketManagerCommand["action"]>(
  request: Request,
  expectedAction: Action,
): Promise<Readonly<{
  command: Extract<TicketManagerCommand, { action: Action }>;
  idempotencyKey: string;
}>> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!UUID_PATTERN.test(idempotencyKey)) throw new TicketManagerRequestError();
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new TicketManagerRequestError();
  let value: Record<string, unknown>;
  try {
    value = await readBoundedJsonObject(request, MAXIMUM_BODY_BYTES);
  } catch {
    throw new TicketManagerRequestError();
  }
  const command = expectedAction.startsWith("entry_") ? readEntryRecovery(value, expectedAction as TicketEntryRecoveryAction)
    : expectedAction === "session_revoke" ? readSessionRevoke(value)
    : expectedAction === "assisted_admission" ? readAssistedAdmission(value)
      : expectedAction === "refund_resolve" ? readRefundResolve(value)
        : readEmailRetry(value);
  return {
    command: command as Extract<TicketManagerCommand, { action: Action }>,
    idempotencyKey,
  };
}

export function readTicketManagerScope(request: Request): TicketOperationScope {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "scope")) {
    throw new TicketManagerRequestError();
  }
  const values = url.searchParams.getAll("scope");
  if (values.length !== 1 || (values[0] !== "all" && values[0] !== "refund")) {
    throw new TicketManagerRequestError();
  }
  return values[0];
}

export function ticketManagerFailure(
  error: TicketManagerFailureCode,
  currentVersion: number | null = null,
  recovery: string | null = null,
): TicketManagerFailure {
  return { ok: false, error, currentVersion, recovery };
}

export function ticketManagerPrivateHeaders() {
  return {
    "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  } as const;
}

export class TicketManagerRequestError extends Error {
  constructor() {
    super("TICKET_MANAGER_REQUEST_INVALID");
    this.name = "TicketManagerRequestError";
  }
}

async function executeMutation<Command extends TicketManagerCommand>(
  action: TicketOperationMutationResponse["action"],
  execute: (
    context: TicketManagerMutationContext,
    command: Command,
  ) => Promise<TicketManagerRpcResult>,
  context: Omit<TicketManagerMutationContext, "requestHash">,
  command: Command,
  now: () => number,
): Promise<TicketOperationMutationResponse | TicketManagerFailure> {
  const observedAt = now();
  if (!Number.isFinite(observedAt)) return ticketManagerFailure("operation_failed");
  let raw: TicketManagerRpcResult;
  try {
    raw = await execute({
      ...context,
      requestHash: hashManagerRequest(command),
    }, command);
  } catch {
    return ticketManagerFailure("operation_failed", null, "状態を再読込してから再試行してください。");
  }
  return projectMutation(action, raw, observedAt);
}

function projectMutation(
  action: TicketOperationMutationResponse["action"],
  raw: TicketManagerRpcResult,
  observedAt: number,
): TicketOperationMutationResponse | TicketManagerFailure {
  const databaseAction = typeof raw.action === "string" ? raw.action : "";
  if (["revoked", "committed", "requeued", "resolved_voided", "resolved_admitted_exception", "dismissed_no_money_moved"].includes(databaseAction)) {
    const entityVersion = readPositiveInteger(
      raw.entityVersion ?? raw.resolutionVersion ?? raw.committedOrderVersion,
    );
    const auditLogId = readUuid(raw.auditLogId ?? raw.auditId);
    if (entityVersion === null || auditLogId === null) {
      return ticketManagerFailure("operation_failed");
    }
    return {
      ok: true,
      action,
      entityVersion,
      auditLogId,
      reused: raw.reused === true,
      serverNow: new Date(observedAt).toISOString(),
    };
  }
  const currentVersion = readPositiveInteger(
    raw.entityVersion ?? raw.resolutionVersion ?? raw.currentVersion,
  );
  const reason = typeof raw.reason === "string" ? raw.reason : databaseAction;
  if (databaseAction === "version_conflict" || databaseAction === "conflict") {
    return ticketManagerFailure(
      "version_conflict",
      currentVersion,
      reason === "idempotency_in_progress"
        ? "同じ操作を処理中です。状態を再読込してください。"
        : "表示中の状態が更新されました。再読込して確認してください。",
    );
  }
  const code = mapDatabaseReason(reason);
  return ticketManagerFailure(code, currentVersion, recoveryFor(code));
}

function mapDatabaseReason(reason: string): TicketManagerFailureCode {
  if (/not_found/u.test(reason)) return "not_found";
  if (/version|idempotency/u.test(reason)) return "version_conflict";
  if (/too_early|too_late|window|event_day_closed|event_session_closed|event_session_cancelled/u.test(reason)) {
    return "outside_admission_window";
  }
  if (/payment_not_settled/u.test(reason)) return "payment_not_settled";
  if (/refund|void|dispute/u.test(reason)) return "ticket_refunded";
  if (/environment|event_session_mismatch|authority_binding/u.test(reason)) return "wrong_environment";
  if (/suppressed|provider/u.test(reason)) return "provider_disabled";
  if (/already|not_retryable|terminal|recovery_mail_impossible/u.test(reason)) return "terminal_state";
  if (/invalid|selection|required|request_id_reused|owner_role_required/u.test(reason)) return "invalid_request";
  return "operation_failed";
}

function recoveryFor(code: TicketManagerFailureCode) {
  if (code === "version_conflict") return "状態を再読込してから、内容を確認して再実行してください。";
  if (code === "provider_disabled") return "メールproviderの状態を確認し、復旧後に再試行してください。";
  if (code === "outside_admission_window") return "Event Sessionと入場時間帯を確認してください。";
  return null;
}

function hashManagerRequest(command: TicketManagerCommand) {
  return createHash("sha256")
    .update("ghost.ticket-manager.command.v1\0", "utf8")
    .update(JSON.stringify(command), "utf8")
    .digest("hex");
}

function readSessionRevoke(value: Record<string, unknown>): TicketSessionRevokeCommand {
  assertKeys(value, ["orderPublicCode", "sessionId", "expectedVersion", "reason"]);
  return {
    action: "session_revoke",
    orderPublicCode: readPublicCode(value.orderPublicCode),
    sessionId: requireUuid(value.sessionId),
    expectedVersion: requireVersion(value.expectedVersion),
    reason: requireReason(value.reason),
  };
}

function readEntryRecovery(value: Record<string, unknown>, action: TicketEntryRecoveryAction): TicketEntryRecoveryCommand {
  assertKeys(value, ["orderPublicCode", "environment", "expectedVersion", "expectedGeneration", "reason", "originalOperationId", "guestCount", "confirmation"]);
  if (!["entry_rotate", "entry_revoke", "entry_resend", "entry_exception"].includes(action)) throw new TicketManagerRequestError();
  const exception = action === "entry_exception";
  if (exception) {
    if (value.expectedGeneration !== null || typeof value.confirmation !== "string" || value.confirmation.trim() !== value.confirmation || value.confirmation.length < 8 || value.confirmation.length > 400
      || !Number.isSafeInteger(value.guestCount) || (value.guestCount as number) < 1 || (value.guestCount as number) > 20) throw new TicketManagerRequestError();
  } else if (value.originalOperationId !== null || value.guestCount !== null || value.confirmation !== null) throw new TicketManagerRequestError();
  return { action, orderPublicCode: readPublicCode(value.orderPublicCode), environment: readEnvironment(value.environment), expectedVersion: requireVersion(value.expectedVersion), reason: requireReason(value.reason),
    expectedGeneration: exception ? null : requireVersion(value.expectedGeneration), originalOperationId: exception ? requireUuid(value.originalOperationId) : null,
    guestCount: exception ? value.guestCount as number : null, confirmation: exception ? value.confirmation as string : null };
}

function readAssistedAdmission(value: Record<string, unknown>): TicketAssistedAdmissionCommand {
  assertKeys(value, ["orderPublicCode", "environment", "eventSessionId", "admissionIds", "expectedVersion", "reason"]);
  if (!Array.isArray(value.admissionIds) || value.admissionIds.length < 1 || value.admissionIds.length > 20) {
    throw new TicketManagerRequestError();
  }
  const admissionIds = value.admissionIds.map(requireUuid);
  if (new Set(admissionIds).size !== admissionIds.length) throw new TicketManagerRequestError();
  return {
    action: "assisted_admission",
    orderPublicCode: readPublicCode(value.orderPublicCode),
    environment: readEnvironment(value.environment),
    eventSessionId: requireUuid(value.eventSessionId),
    admissionIds,
    expectedVersion: requireVersion(value.expectedVersion),
    reason: requireReason(value.reason),
  };
}

function readRefundResolve(value: Record<string, unknown>): TicketRefundResolveCommand {
  assertKeys(value, [
    "reviewId", "resolution", "allocations", "expectedVersion",
    "observationVersion", "observationHash", "reason",
  ]);
  if (!Array.isArray(value.allocations) || value.allocations.length > 20) {
    throw new TicketManagerRequestError();
  }
  const allocations = value.allocations.map((allocation) => {
    if (!isRecord(allocation)) throw new TicketManagerRequestError();
    assertKeys(allocation, ["admissionId", "amountMinor"]);
    return {
      admissionId: requireUuid(allocation.admissionId),
      amountMinor: requirePositiveInteger(allocation.amountMinor),
    };
  });
  if (new Set(allocations.map(({ admissionId }) => admissionId)).size !== allocations.length) {
    throw new TicketManagerRequestError();
  }
  const resolution = value.resolution;
  if (!["apply_and_void", "record_admitted_exception", "dismiss_no_money_moved"].includes(String(resolution))) {
    throw new TicketManagerRequestError();
  }
  if (resolution === "dismiss_no_money_moved" ? allocations.length !== 0 : allocations.length < 1) {
    throw new TicketManagerRequestError();
  }
  return {
    action: "refund_resolve",
    reviewId: requireUuid(value.reviewId),
    resolution: resolution as TicketRefundResolveCommand["resolution"],
    allocations,
    expectedVersion: requireVersion(value.expectedVersion),
    observationVersion: requireVersion(value.observationVersion),
    observationHash: requireSha256(value.observationHash),
    reason: requireReason(value.reason),
  };
}

function readEmailRetry(value: Record<string, unknown>): TicketEmailRetryCommand {
  assertKeys(value, ["emailJobId", "issueRecoveryMail", "expectedVersion", "reason"]);
  if (typeof value.issueRecoveryMail !== "boolean") throw new TicketManagerRequestError();
  return {
    action: "email_retry",
    emailJobId: requireUuid(value.emailJobId),
    issueRecoveryMail: value.issueRecoveryMail,
    expectedVersion: requireVersion(value.expectedVersion),
    reason: requireReason(value.reason),
  };
}

function capabilityState(enabled: boolean, ready: boolean) {
  return enabled ? ready ? "ready" as const : "degraded" as const : "disabled" as const;
}

function assertKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  if (actual.length !== sorted.length || actual.some((key, index) => key !== sorted[index])) {
    throw new TicketManagerRequestError();
  }
}

function readPublicCode(value: unknown) {
  if (typeof value !== "string" || !PUBLIC_CODE_PATTERN.test(value)) {
    throw new TicketManagerRequestError();
  }
  return value;
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new TicketManagerRequestError();
  return value;
}

function readEnvironment(value: unknown): TicketEnvironment {
  if (value !== "live" && value !== "test") throw new TicketManagerRequestError();
  return value;
}

function requireVersion(value: unknown) {
  const version = readPositiveInteger(value);
  if (version === null) throw new TicketManagerRequestError();
  return version;
}

function requirePositiveInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new TicketManagerRequestError();
  return value as number;
}

function requireReason(value: unknown) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 8 || value.length > 240) {
    throw new TicketManagerRequestError();
  }
  return value;
}

function requireSha256(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TicketManagerRequestError();
  }
  return value;
}

function readPositiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function readUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
