import "server-only";

import { decryptCustomerProfileValue } from "../customerProfileCrypto";
import { createSupabaseAdminClient } from "../supabaseAdmin";
import type {
  TicketEnvironment,
  TicketManagerRepository,
  TicketManagerRpcResult,
} from "./ticketManagerOperations";
import { assertTicketCanaryRuntimeAuthority } from "./ticketCanaryRuntimeGuard";
import { createTicketEntryMaterial } from "./ticketOrderEntryCrypto";
import { readTicketAuthKeyring } from "./ticketAuthCrypto";
import { readPublicOrigin } from "./ticketWalletProductionRuntime";
import { readRuntimeEnvironment } from "../runtimeEnvironment";
import { requireResendRuntimeConfiguration } from "../transactionalEmail/resendRuntimeConfiguration";
import {
  maskTicketEmail,
  projectTicketManagerRefundFacts,
  verifyTicketManagerRefundAllocation,
} from "./ticketManagerProjection";

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;
type DbRow = Record<string, unknown>;

export type TicketManagerQueueResponse = Readonly<{
  ok: true;
  serverNow: string;
  environment: TicketEnvironment;
  eventSessions: readonly DbRow[];
  recentAdmissions: readonly DbRow[];
  health: DbRow;
  items: readonly DbRow[];
}>;

export type TicketManagerOrderResponse = Readonly<{
  ok: true;
  serverNow: string;
  health: DbRow;
  order: DbRow;
}>;

type RuntimeDependencies = Readonly<{
  client?: SupabaseClient;
  environment?: TicketEnvironment;
  now?: () => number;
  decryptEmail?: (ciphertext: Buffer | Uint8Array | string) => string;
  emailProviderState?: () => "ready" | "disabled" | "degraded";
  scheduleEmailJob?: (jobId: string) => void;
}>;

export function createTicketManagerProductionRepository(
  dependencies: RuntimeDependencies = {},
): TicketManagerRepository<TicketManagerQueueResponse, TicketManagerOrderResponse> {
  assertTicketCanaryRuntimeAuthority();
  const client = dependencies.client ?? createSupabaseAdminClient();
  const environment = dependencies.environment ?? readTicketEnvironment();
  const now = dependencies.now ?? Date.now;
  const decryptEmail = dependencies.decryptEmail ?? decryptCustomerProfileValue;
  const emailProviderState = dependencies.emailProviderState ?? (() => "disabled" as const);

  return {
    async readQueue(scope) {
      const observedAt = requireClock(now());
      const serverNow = new Date(observedAt).toISOString();
      const [refunds, checkoutReviews, eventSessions, recoveryOrders] = await Promise.all([
        selectRows(client.from("ticket_refund_events")
          .select("id,ticket_order_id,amount_yen,resolution_status,resolution_version,observation_version,observation_set_hash,observation_history_state,observation_history_reason,review_reason,money_may_have_moved,updated_at")
          .eq("environment", environment)
          .in("resolution_status", ["review_required", "conflict_review"])
          .is("resolved_at", null)
          .order("updated_at", { ascending: false })
          .limit(501)),
        selectRows(client.from("ticket_checkout_actions")
          .select("id,ticket_order_id,state,review_reason,provider_attempt_count,reconciliation_count,updated_at")
          .eq("environment", environment)
          .eq("state", "review_required")
          .order("updated_at", { ascending: false })
          .limit(501)),
        selectRows(client.from("ticket_event_sessions")
          .select("id,catalog_event_id,event_date,door_at,admission_opens_at,admission_closes_at,admission_state,enabled")
          .eq("environment", environment)
          .order("event_date", { ascending: true })
          .limit(30)),
        scope === "refund" ? [] : selectRows(client.from("ticket_orders")
          .select("id,public_code,event_title,event_date,environment,status,purchaser_email_ciphertext,purchaser_email_hash,event_session_id,admission_version,updated_at")
          .eq("environment", environment)
          .eq("check_in_mode", "wallet_swipe")
          .order("updated_at", { ascending: false })
          .limit(100)),
      ]);
      if (refunds.length > 500 || checkoutReviews.length > 500 || refunds.length + checkoutReviews.length > 500) {
        throw databaseError();
      }
      const obligationOrderIds = uniqueStrings([
        ...refunds.map((refund) => refund.ticket_order_id),
        ...checkoutReviews.map((review) => review.ticket_order_id),
      ]);
      const obligationOrders = obligationOrderIds.length === 0 ? [] : await selectRows(client.from("ticket_orders")
        .select("id,public_code,event_title,event_date,environment,status,purchaser_email_ciphertext,purchaser_email_hash,event_session_id,admission_version,updated_at")
        .eq("environment", environment)
        .in("id", obligationOrderIds)
        .limit(500));
      assertCompleteObligationOrderSet(obligationOrderIds, obligationOrders);
      const obligationOrderById = new Map(obligationOrders.map((order) => [requireUuid(order.id), order]));
      const orders = [
        ...obligationOrders,
        ...recoveryOrders.filter((order) => !obligationOrderById.has(requireUuid(order.id))),
      ];
      const orderById = new Map(orders.map((order) => [requireString(order.id), order]));
      const refundItems = refunds.map((refund) => queueItemFromRefund(
        obligationOrderById.get(requireUuid(refund.ticket_order_id)) ?? failDatabase(),
        refund,
        decryptEmail,
      ));
      const checkoutReviewItems = checkoutReviews.map((review) => queueItemFromCheckoutReview(
        obligationOrderById.get(requireUuid(review.ticket_order_id)) ?? failDatabase(),
        review,
        decryptEmail,
      ));
      const financialReviewItems = [...refundItems, ...checkoutReviewItems].sort(compareQueueItems);
      const rails = eventSessions.map((eventSession) => projectEventSessionRail(
        eventSession,
        orderEventTitle(orders, eventSession),
        observedAt,
      ));

      if (scope === "refund") {
        return {
          ok: true,
          serverNow,
          environment,
          eventSessions: rails,
          recentAdmissions: [],
          health: disabledHealth(),
          items: financialReviewItems,
        };
      }

      const identityHashes = uniqueStrings(recoveryOrders.map((order) => order.purchaser_email_hash));
      const orderIds = recoveryOrders.map((order) => requireString(order.id));
      const [walletProjection, admissions] = await Promise.all([
        callManagerReadRpc(client, "read_ticket_wallet_manager_queue_v29", {
          p_environment: environment,
          p_identity_email_hashes: identityHashes,
        }),
        orderIds.length === 0 ? [] : selectRows(client.from("ticket_admissions")
          .select("id,ticket_order_id,status,admitted_at,updated_at")
          .in("ticket_order_id", orderIds)
          .order("updated_at", { ascending: false })
          .limit(500)),
      ]);
      const sessions = projectedRows(walletProjection, "sessions");
      const emailJobs = projectedRows(walletProjection, "emailJobs");
      const recentProviderEvents = projectedRows(walletProjection, "providerEvents");
      const circuits = projectedRows(walletProjection, "providerCircuits");
      const recoveryItems = buildRecoveryQueueItems(
        recoveryOrders,
        sessions,
        emailJobs,
        admissions,
        decryptEmail,
      );
      const items = [
        ...financialReviewItems,
        ...recoveryItems.sort(compareQueueItems).slice(0, 500 - financialReviewItems.length),
      ];
      const recentAdmissions = admissions
        .filter((admission) => admission.status === "admitted" && admission.admitted_at !== null)
        .slice(0, 20)
        .flatMap((admission) => {
          const order = orderById.get(requireString(admission.ticket_order_id));
          if (!order) return [];
          return [{
            admissionId: requireUuid(admission.id),
            publicCode: requirePublicCode(order.public_code),
            eventTitle: requireBoundedText(order.event_title, 160),
            admittedCount: 1,
            admittedAt: canonicalInstant(admission.admitted_at),
          }];
        });
      return {
        ok: true,
        serverNow,
        environment,
        eventSessions: rails,
        recentAdmissions,
        health: projectHealth(emailJobs, recentProviderEvents, circuits, emailProviderState(), observedAt),
        items,
      };
    },

    async readOrder(publicCode, scope) {
      const observedAt = requireClock(now());
      const order = await maybeOne(client.from("ticket_orders")
        .select("id,public_code,event_title,event_date,environment,status,check_in_mode,admission_policy,purchaser_email_ciphertext,purchaser_email_hash,event_session_id,admission_version,amount_yen,items_json,updated_at")
        .eq("environment", environment)
        .eq("public_code", publicCode)
        .maybeSingle());
      if (!order) return null;
      const orderId = requireUuid(order.id);
      const eventSessionId = requireUuid(order.event_session_id);
      const identityHash = nullableString(order.purchaser_email_hash);
      const [eventSession, admissions, refunds, checkoutReviews] = await Promise.all([
        maybeOne(client.from("ticket_event_sessions")
          .select("id,catalog_event_id,event_date,door_at,admission_opens_at,admission_closes_at,admission_state,enabled")
          .eq("id", eventSessionId)
          .eq("environment", environment)
          .maybeSingle()),
        selectRows(client.from("ticket_admissions")
          .select("id,serial,ticket_type_id,ticket_type_label,status,admitted_at,updated_at")
          .eq("ticket_order_id", orderId)
          .order("serial", { ascending: true })
          .limit(20)),
        selectRows(client.from("ticket_refund_events")
          .select("id,amount_yen,resolution_status,resolution_version,observation_version,observation_set_hash,observation_history_state,observation_history_reason,admission_serials,review_reason,money_may_have_moved,provider_status,updated_at,resolved_at")
          .eq("ticket_order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(20)),
        selectRows(client.from("ticket_checkout_actions")
          .select("id,state,review_reason,updated_at")
          .eq("ticket_order_id", orderId)
          .eq("environment", environment)
          .eq("state", "review_required")
          .order("updated_at", { ascending: false })
          .limit(1)),
      ]);
      if (!eventSession) throw databaseError();
      const refundIds = refunds.map((refund) => requireUuid(refund.id));
      const refundObservations = refundIds.length === 0 ? [] : await selectRows(
        client.from("ticket_refund_observations")
          .select("ticket_refund_event_id,observation_version,facts_hash,amount_yen,provider_status,input_admission_serials,input_valid,validation_reason,observed_at")
          .in("ticket_refund_event_id", refundIds)
          .order("observation_version", { ascending: true })
          .limit(201),
      );
      if (refundObservations.length > 200) throw databaseError();
      const checkoutReview = checkoutReviews[0] ?? null;

      const base = {
        publicCode: requirePublicCode(order.public_code),
        maskedEmail: maskedOrderEmail(order, decryptEmail),
        environment,
        expectedVersion: requirePositiveInteger(order.admission_version),
        eventSession: projectEventSessionRail(
          eventSession,
          requireBoundedText(order.event_title, 160),
          observedAt,
        ),
        admissions: admissions.map(projectAdmissionSummary),
        refundReview: projectRefundReview(refunds, order, admissions, refundObservations),
      };

      if (scope === "refund" || order.check_in_mode !== "wallet_swipe") {
        return {
          ok: true,
          serverNow: new Date(observedAt).toISOString(),
          health: disabledHealth(),
          order: {
            ...base,
            wallet: emptyWalletState(),
            emailJobs: [],
            timeline: await readOrderAuditTimeline(client, orderId, []),
            safeRecoveryInstruction: checkoutReview === null
              ? "返金reviewのprovider証跡と券別金額を確認してください。Stripe上の返金操作はこの画面では行いません。"
              : checkoutReviewInstruction(checkoutReview),
          },
        };
      }

      const [walletProjection, operations] = await Promise.all([
        callManagerReadRpc(client, "read_ticket_wallet_manager_order_v29", {
          p_environment: environment,
          p_identity_email_hash: identityHash,
          p_order_id: orderId,
        }),
        selectRows(client.from("ticket_admission_operations")
          .select("id,state,updated_at")
          .eq("ticket_order_id", orderId)
          .order("updated_at", { ascending: false })
          .limit(20)),
      ]);
      const sessions = projectedRows(walletProjection, "sessions");
      const emailJobs = projectedRows(walletProjection, "emailJobs");
      const challenges = projectedRows(walletProjection, "otpChallenges");
      const managerAudits = projectedRows(walletProjection, "managerAudits");
      const providerEvents = projectedRows(walletProjection, "providerEvents");
      const circuits = projectedRows(walletProjection, "providerCircuits");
      return {
        ok: true,
        serverNow: new Date(observedAt).toISOString(),
        health: projectHealth(emailJobs, providerEvents, circuits, emailProviderState(), observedAt),
        order: {
          ...base,
          ...(order.admission_policy === "order_together_v1" ? { entry: await callManagerRpc(client, "read_ticket_entry_manager_v53", { p_order: orderId, p_environment: environment }) } : {}),
          wallet: projectWalletState(sessions, emailJobs.filter(job => job.purpose !== "ticket_wallet_purchase"), challenges, operations, observedAt),
          emailJobs: emailJobs.map(projectEmailJob),
          timeline: await readOrderAuditTimeline(client, orderId, managerAudits),
          safeRecoveryInstruction: checkoutReview === null
            ? "本人確認、Event Session、支払・返金状態を確認し、理由を記録して必要最小限の操作だけを実行してください。"
            : checkoutReviewInstruction(checkoutReview),
        },
      };
    },

    async recoverEntry(context, command) {
      if (command.environment !== environment) return rejected("environment_mismatch");
      const order = await maybeOne(client.from("ticket_orders").select("id,event_session_id,environment,stripe_account_key,admission_policy")
        .eq("public_code", command.orderPublicCode).eq("environment", environment).maybeSingle());
      if (!order || order.admission_policy !== "order_together_v1") return rejected("order_not_found");
      const origin = readPublicOrigin();
      const account = requireString(order.stripe_account_key);
      if (account !== "platform") return rejected("authority_binding_mismatch");
      const material = command.action === "entry_rotate" ? createTicketEntryMaterial(readTicketAuthKeyring(), {
        orderId: requireUuid(order.id), eventSessionId: requireUuid(order.event_session_id), environment, origin, account, generation: (command.expectedGeneration ?? 0) + 1,
      }) : null;
      const sends = command.action === "entry_rotate" || command.action === "entry_resend";
      const mail = sends ? requireResendRuntimeConfiguration(process.env) : null;
      const result = await callManagerRpc(client, "manager_ticket_entry_v53", {
        p_actor: context.actorAdminId, p_request_id: context.requestId, p_key: context.idempotencyKey, p_hash: context.requestHash,
        p_order: order.id, p_environment: environment, p_expected_version: command.expectedVersion, p_action: command.action, p_reason: command.reason,
        p_confirmation: command.confirmation, p_original_operation: command.originalOperationId, p_count: command.guestCount,
        p_expected_generation: command.expectedGeneration, p_origin: origin, p_account: account,
        p_link: material?.linkId ?? null, p_verifier: material?.verifier ?? null, p_ciphertext: material?.ciphertext ?? null, p_from: mail?.from ?? null, p_reply: mail?.replyTo ?? null,
      });
      if (result.action === "committed" && typeof result.emailJobId === "string") {
        try { dependencies.scheduleEmailJob?.(requireUuid(result.emailJobId)); } catch { /* durable worker retries */ }
      }
      return result;
    },

    async revokeSession(context, command) {
      return callManagerRpc(client, "manager_revoke_ticket_wallet_session_v29", {
        p_actor_admin_id: context.actorAdminId,
        p_request_id: context.requestId,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
        p_order_public_code: command.orderPublicCode,
        p_session_id: command.sessionId,
        p_expected_version: command.expectedVersion,
        p_reason: command.reason,
      });
    },

    async assistAdmission(context, command) {
      const order = await maybeOne(client.from("ticket_orders")
        .select("id,event_session_id,environment")
        .eq("public_code", command.orderPublicCode)
        .eq("check_in_mode", "wallet_swipe")
        .maybeSingle());
      if (!order) return rejected("order_not_found");
      if (order.environment !== environment || command.environment !== environment) {
        return rejected("environment_mismatch");
      }
      if (order.event_session_id !== command.eventSessionId) {
        return rejected("event_session_mismatch");
      }
      return callManagerRpc(client, "manager_admit_ticket_admissions_v30", {
        p_actor_admin_id: context.actorAdminId,
        p_request_id: context.requestId,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
        p_environment: environment,
        p_event_session_id: command.eventSessionId,
        p_ticket_order_id: requireUuid(order.id),
        p_admission_ids: [...command.admissionIds],
        p_expected_version: command.expectedVersion,
        p_reason: command.reason,
      });
    },

    async resolveRefund(context, command) {
      const refund = await maybeOne(client.from("ticket_refund_events")
        .select("id,ticket_order_id,amount_yen,money_may_have_moved,observation_version,observation_set_hash,observation_history_state,observation_history_reason")
        .eq("id", command.reviewId)
        .eq("environment", environment)
        .maybeSingle());
      if (!refund) return rejected("refund_event_not_found");
      const orderId = requireUuid(refund.ticket_order_id);
      const [order, admissions, observations] = await Promise.all([
        maybeOne(client.from("ticket_orders")
          .select("amount_yen,items_json")
          .eq("id", orderId)
          .eq("environment", environment)
          .maybeSingle()),
        selectRows(client.from("ticket_admissions")
          .select("id,serial,ticket_type_id,status")
          .eq("ticket_order_id", orderId)
          .order("serial", { ascending: true })
          .limit(20)),
        selectRows(client.from("ticket_refund_observations")
          .select("ticket_refund_event_id,observation_version,facts_hash,amount_yen,provider_status,input_admission_serials,input_valid,validation_reason,observed_at")
          .eq("ticket_refund_event_id", command.reviewId)
          .order("observation_version", { ascending: true })
          .limit(201)),
      ]);
      if (!order) return rejected("refund_event_not_found");
      if (observations.length > 200) return rejected("refund_observation_authority_ambiguous");
      const allocation = verifyTicketManagerRefundAllocation(
        command, refund, order, admissions, observations,
      );
      if (!allocation.ok) return rejected(allocation.reason);
      return callManagerRpc(client, "resolve_ticket_refund_review_v26", {
        p_actor_admin_id: context.actorAdminId,
        p_request_id: context.requestId,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
        p_refund_event_id: command.reviewId,
        p_expected_version: command.expectedVersion,
        p_expected_observation_version: command.observationVersion,
        p_expected_observation_hash: command.observationHash,
        p_decision: allocation.decision,
        p_admission_serials: allocation.serials,
        p_reason: command.reason,
      });
    },

    async retryEmail(context, command) {
      const result = await callManagerRpc(client, "manager_retry_transactional_email_job_v29", {
        p_actor_admin_id: context.actorAdminId,
        p_request_id: context.requestId,
        p_idempotency_key: context.idempotencyKey,
        p_request_hash: context.requestHash,
        p_email_job_id: command.emailJobId,
        p_issue_recovery_mail: command.issueRecoveryMail,
        p_expected_version: command.expectedVersion,
        p_reason: command.reason,
      });
      if (result.action === "requeued" && typeof result.queuedJobId === "string") {
        try {
          dependencies.scheduleEmailJob?.(requireUuid(result.queuedJobId));
        } catch {
          // The durable outbox and cron remain authoritative if immediate scheduling fails.
        }
      }
      return result;
    },
  };
}

function buildRecoveryQueueItems(
  orders: readonly DbRow[],
  sessions: readonly DbRow[],
  emailJobs: readonly DbRow[],
  admissions: readonly DbRow[],
  decryptEmail: (ciphertext: Buffer | Uint8Array | string) => string,
) {
  const result: DbRow[] = [];
  for (const order of orders) {
    const orderId = requireUuid(order.id);
    const hash = nullableString(order.purchaser_email_hash);
    const orderSessions = hash === null ? [] : sessions.filter((session) => session.identity_email_hash === hash);
    const orderJobs = hash === null ? [] : emailJobs.filter((job) => job.recipient_email_hash === hash && (!job.ticket_order_id || job.ticket_order_id === orderId));
    const orderAdmissions = admissions.filter((admission) => admission.ticket_order_id === orderId);
    for (const job of orderJobs.filter((candidate) => ["retry", "dead", "configuration"].includes(String(candidate.state)))) {
      result.push(queueItem(order, decryptEmail, {
        id: requireUuid(job.id),
        kind: "email_delivery",
        priority: job.state === "dead" || job.state === "configuration" ? "urgent" : "attention",
        status: requireString(job.state),
        statusLabel: job.state === "retry" ? "メール再送待ち" : "メール配信停止",
        summary: job.purpose === "ticket_wallet_purchase" ? "購入案内の配送状態を確認してください。購入済み券は本人認証で再取得できます。" : "OTPメールの配信状態を確認してください。",
        updatedAt: canonicalInstant(job.updated_at),
        expectedVersion: requirePositiveInteger(job.entity_version),
      }));
    }
    for (const session of orderSessions.filter((candidate) => candidate.revoked_at === null)) {
      result.push(queueItem(order, decryptEmail, {
        id: requireUuid(session.id),
        kind: "wallet_session",
        priority: "normal",
        status: "active",
        statusLabel: "Wallet session有効",
        summary: "端末紛失時は本人確認後にsessionを失効できます。",
        updatedAt: canonicalInstant(session.updated_at),
        expectedVersion: requirePositiveInteger(session.entity_version),
      }));
    }
    if (orderAdmissions.length > 0) {
      const issued = orderAdmissions.filter((admission) => admission.status === "issued").length;
      const admitted = orderAdmissions.filter((admission) => admission.status === "admitted").length;
      result.push(queueItem(order, decryptEmail, {
        id: orderId,
        kind: "admission",
        priority: issued > 0 ? "normal" : "attention",
        status: issued > 0 ? "issued" : admitted > 0 ? "admitted" : "void",
        statusLabel: issued > 0 ? `未使用 ${issued}枚` : admitted > 0 ? `入場済み ${admitted}枚` : "利用不可",
        summary: `${orderAdmissions.length}枚の入場状態`,
        updatedAt: canonicalInstant(order.updated_at),
        expectedVersion: requirePositiveInteger(order.admission_version),
      }));
    }
  }
  return result;
}

function queueItemFromRefund(
  order: DbRow,
  refund: DbRow,
  decryptEmail: (ciphertext: Buffer | Uint8Array | string) => string,
) {
  const historyIncomplete = refund.observation_history_state === "legacy_incomplete";
  const historyState = historyIncomplete ? "legacy_incomplete"
    : refund.observation_history_state === "complete" ? "complete" : failDatabase();
  const historyReason = historyIncomplete
    ? requireBoundedText(refund.observation_history_reason, 80)
    : null;
  return queueItem(order, decryptEmail, {
    id: requireUuid(refund.id),
    kind: "refund_review",
    priority: refund.money_may_have_moved === true ? "urgent" : "attention",
    status: requireString(refund.resolution_status),
    statusLabel: historyIncomplete ? "provider返金履歴が不完全"
      : refund.money_may_have_moved === true ? "返金後の券割当を要確認" : "返金事実を要確認",
    summary: historyIncomplete
      ? "旧履歴から完全な返金権限を復元できません。Stripe証跡をOwnerが保守的に照合してください。"
      : `¥${requirePositiveInteger(refund.amount_yen).toLocaleString("ja-JP")} のreview`,
    updatedAt: canonicalInstant(refund.updated_at),
    expectedVersion: requirePositiveInteger(refund.resolution_version),
    observationVersion: requirePositiveInteger(refund.observation_version),
    observationHash: requireHash(refund.observation_set_hash),
    observationHistoryState: historyState,
    observationHistoryReason: historyReason,
  });
}

function queueItemFromCheckoutReview(
  order: DbRow,
  review: DbRow,
  decryptEmail: (ciphertext: Buffer | Uint8Array | string) => string,
) {
  const reason = requireBoundedText(review.review_reason, 48);
  return queueItem(order, decryptEmail, {
    id: requireUuid(review.id),
    kind: "checkout_review",
    priority: "urgent",
    status: reason,
    statusLabel: checkoutReviewLabel(reason),
    summary: "Checkoutのprovider証跡と発券状態を確認してください。",
    updatedAt: canonicalInstant(review.updated_at),
    expectedVersion: requirePositiveInteger(order.admission_version),
  });
}

function checkoutReviewLabel(reason: string) {
  if (reason === "wallet_purchaser_email_required") return "購入メール要確認";
  if (reason === "provider_outcome_unknown") return "決済結果を要照合";
  if (reason === "provider_completion_reconciliation_required") return "決済完了・発券要照合";
  if (reason === "provider_binding_mismatch") return "Checkout権限不一致";
  if (reason === "provider_request_unreproducible") return "Checkout再現不能";
  if (reason === "provider_result_conflict") return "Checkout証跡不一致";
  if (reason === "payment_dispute_open") return "支払係争中";
  if (reason === "charge_refunded") return "返金済み・発券停止";
  return "Checkout確認";
}

function checkoutReviewInstruction(review: DbRow) {
  const reason = requireBoundedText(review.review_reason, 48);
  if (reason === "wallet_purchaser_email_required") {
    return "Checkoutの購入メールと暗号化機能の状態をprovider側で確認してください。生メールはこの画面へ入力せず、発券不能ならStripeで返金し、verified refund webhookの反映まで項目を残してください。";
  }
  return "Checkout Session、PaymentIntent、注文の証跡をStripeで照合してください。金銭操作はこの画面で行わず、verified terminal／refund webhookの反映まで項目を残してください。";
}

function queueItem(
  order: DbRow,
  decryptEmail: (ciphertext: Buffer | Uint8Array | string) => string,
  item: DbRow,
) {
  return {
    ...item,
    publicCode: requirePublicCode(order.public_code),
    maskedEmail: maskedOrderEmail(order, decryptEmail),
    eventTitle: requireBoundedText(order.event_title, 160),
    eventDate: requireCalendarDate(order.event_date),
    environment: requireEnvironment(order.environment),
  };
}

function projectEventSessionRail(eventSession: DbRow, eventTitle: string, observedAt: number) {
  const opensAt = canonicalInstant(eventSession.admission_opens_at);
  const closesAt = canonicalInstant(eventSession.admission_closes_at);
  const state = eventSession.enabled !== true || eventSession.admission_state !== "scheduled"
    || observedAt >= Date.parse(closesAt) ? "closed"
    : observedAt >= Date.parse(opensAt) ? "open" : "scheduled";
  return {
    eventSessionId: requireUuid(eventSession.id),
    eventTitle,
    eventDate: requireCalendarDate(eventSession.event_date),
    doorsAt: canonicalInstant(eventSession.door_at),
    admissionOpensAt: opensAt,
    admissionClosesAt: closesAt,
    state,
  };
}

function orderEventTitle(orders: readonly DbRow[], eventSession: DbRow) {
  const eventId = requireString(eventSession.id);
  const match = orders.find((order) => order.event_session_id === eventId);
  return match ? requireBoundedText(match.event_title, 160) : requireBoundedText(eventSession.catalog_event_id, 160);
}

function assertCompleteObligationOrderSet(orderIds: readonly string[], orders: readonly DbRow[]) {
  const returned = new Set(orders.map((order) => requireUuid(order.id)));
  if (returned.size !== orderIds.length || orderIds.some((orderId) => !returned.has(orderId))) {
    throw databaseError();
  }
}

function failDatabase(): never {
  throw databaseError();
}

function projectAdmissionSummary(admission: DbRow) {
  const status = admission.status;
  if (status !== "issued" && status !== "admitted" && status !== "void") throw databaseError();
  return {
    admissionId: requireUuid(admission.id),
    serial: requirePositiveInteger(admission.serial),
    label: requireBoundedText(admission.ticket_type_label, 240),
    status,
    admittedAt: admission.admitted_at === null ? null : canonicalInstant(admission.admitted_at),
  };
}

function projectRefundReview(
  refunds: readonly DbRow[],
  order: DbRow,
  admissions: readonly DbRow[],
  observations: readonly DbRow[],
) {
  const refund = refunds.find((candidate) => ["review_required", "conflict_review"].includes(String(candidate.resolution_status)))
    ?? refunds[0];
  if (!refund) return null;
  const pending = ["review_required", "conflict_review"].includes(String(refund.resolution_status))
    && refund.resolved_at === null;
  const authority = projectTicketManagerRefundFacts(
    refund,
    order,
    admissions,
    observations.filter((observation) => observation.ticket_refund_event_id === refund.id),
  );
  const selectedAdmissionIds = admissions
    .filter((admission) => authority.authoritativeAdmissionSerials.includes(Number(admission.serial)))
    .map((admission) => requireUuid(admission.id));
  return {
    reviewId: requireUuid(refund.id),
    status: pending ? "pending" : "resolved",
    expectedVersion: requirePositiveInteger(refund.resolution_version),
    observationVersion: authority.observationVersion,
    observationHash: authority.observationHash,
    amountMinor: authority.authoritativeAmountMinor,
    currency: "jpy",
    providerEventId: `refund-review:${requireUuid(refund.id)}`,
    selectedAdmissionIds,
    conflictReason: nullableBoundedText(refund.review_reason, 240),
    moneyMayHaveMoved: refund.money_may_have_moved === true,
    authoritativeAdmissionSerials: authority.authoritativeAdmissionSerials,
    providerObservations: authority.observations,
    authorityResolvable: authority.authorityResolvable,
    observationHistoryState: authority.observationHistoryState,
    observationHistoryReason: authority.observationHistoryReason,
    resolutionOptions: pending
      ? authority.moneyMayHaveMoved && authority.authorityResolvable
        ? ["apply_and_void", "record_admitted_exception"]
        : authority.moneyMayHaveMoved ? [] : ["dismiss_no_money_moved"]
      : [],
  };
}

function projectWalletState(
  sessions: readonly DbRow[],
  jobs: readonly DbRow[],
  challenges: readonly DbRow[],
  operations: readonly DbRow[],
  observedAt: number,
) {
  const active = sessions.filter((session) => session.revoked_at === null && Date.parse(String(session.expires_at)) > observedAt);
  const latestChallenge = challenges[0];
  const latestOperation = operations[0];
  const latestJob = jobs[0];
  return {
    state: active.length > 0 ? "active"
      : sessions.some((session) => session.revoked_at !== null) ? "revoked"
        : sessions.length > 0 ? "expired" : "not_started",
    activeSessionCount: active.length,
    activeSessions: active.map((session) => ({
      sessionId: requireUuid(session.id),
      createdAt: canonicalInstant(session.created_at),
      expiresAt: canonicalInstant(session.expires_at),
      expectedVersion: requirePositiveInteger(session.entity_version),
    })),
    lastVerifiedAt: sessions[0] ? canonicalInstant(sessions[0].verified_at) : null,
    freshAuthenticationUntil: active[0] ? canonicalInstant(active[0].fresh_until) : null,
    otpDelivery: latestJob ? emailDeliveryState(latestJob) : "not_requested",
    otpRateLimit: latestChallenge && Date.parse(String(latestChallenge.resend_available_at)) > observedAt
      ? "cooldown" : latestChallenge?.state === "locked" ? "blocked" : "available",
    challengeState: latestOperation?.state === "committed" ? "committed"
      : latestOperation?.state === "prepared" ? "prepared"
        : latestOperation?.state === "expired" ? "expired" : "none",
  };
}

export function projectEmailJob(job: DbRow) {
  const status = job.provider_delivery_state === "suppressed" ? "suppressed"
    : job.state === "pending" || job.state === "processing" ? "queued"
      : job.state === "accepted" ? "sent"
        : job.state === "retry" ? "retry" : "dead";
  return {
    emailJobId: requireUuid(job.id),
    purpose: job.purpose === "ticket_wallet_purchase" ? "wallet_access" : "otp",
    status,
    attemptCount: requireNonNegativeInteger(job.attempt_count),
    nextAttemptAt: job.next_attempt_at === null ? null : canonicalInstant(job.next_attempt_at),
    expectedVersion: requirePositiveInteger(job.entity_version),
    retryable: job.purpose !== "ticket_wallet_purchase" && (status === "retry" || status === "dead"),
  };
}

async function readOrderAuditTimeline(
  client: SupabaseClient,
  orderId: string,
  managerAudits: readonly DbRow[],
) {
  const audits = await selectRows(client.from("audit_logs")
    .select("id,action,actor_type,reason,created_at")
    .eq("target_id", orderId)
    .order("created_at", { ascending: false })
    .limit(100));
  return [...audits, ...managerAudits]
    .map((audit) => ({
      auditId: requireUuid(audit.id),
      type: requireBoundedText(audit.action, 200),
      label: auditLabel(requireString(audit.action)),
      occurredAt: canonicalInstant(audit.created_at),
      actorLabel: audit.actor_type === "system" ? "System" : "Owner",
      reason: nullableBoundedText(audit.reason, 240),
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 100);
}

function projectHealth(
  jobs: readonly DbRow[],
  events: readonly DbRow[],
  circuits: readonly DbRow[],
  configuredState: "ready" | "disabled" | "degraded",
  observedAt: number,
) {
  const circuitOpen = circuits.some((circuit) => circuit.is_open === true);
  const lastWebhookAt = events[0] ? canonicalInstant(events[0].occurred_at) : null;
  return {
    emailProvider: configuredState === "disabled" ? "disabled" : circuitOpen ? "degraded" : configuredState,
    outboxRetryCount: jobs.filter((job) => job.state === "retry").length,
    outboxDeadCount: jobs.filter((job) => job.state === "dead" || job.state === "configuration").length,
    webhookFreshness: lastWebhookAt === null ? "unknown"
      : observedAt - Date.parse(lastWebhookAt) <= 15 * 60_000 ? "fresh" : "stale",
    lastWebhookAt,
  };
}

function disabledHealth() {
  return {
    emailProvider: "disabled",
    outboxRetryCount: 0,
    outboxDeadCount: 0,
    webhookFreshness: "unknown",
    lastWebhookAt: null,
  };
}

function emptyWalletState() {
  return {
    state: "not_started",
    activeSessionCount: 0,
    activeSessions: [],
    lastVerifiedAt: null,
    freshAuthenticationUntil: null,
    otpDelivery: "not_requested",
    otpRateLimit: "available",
    challengeState: "none",
  };
}

function emailDeliveryState(job: DbRow) {
  if (job.provider_delivery_state === "delivered") return "delivered";
  if (job.provider_delivery_state === "suppressed") return "suppressed";
  if (["dead", "configuration"].includes(String(job.state))) return "failed";
  return "queued";
}

function maskedOrderEmail(
  order: DbRow,
  decryptEmail: (ciphertext: Buffer | Uint8Array | string) => string,
) {
  const ciphertext = order.purchaser_email_ciphertext;
  if (!(typeof ciphertext === "string" || ciphertext instanceof Uint8Array)) return "•••@•••";
  try {
    return maskTicketEmail(decryptEmail(ciphertext));
  } catch {
    return "•••@•••";
  }
}

function compareQueueItems(left: DbRow, right: DbRow) {
  const rank = { urgent: 0, attention: 1, normal: 2 } as const;
  const priority = rank[left.priority as keyof typeof rank] - rank[right.priority as keyof typeof rank];
  return priority || requireString(right.updatedAt).localeCompare(requireString(left.updatedAt));
}

function auditLabel(action: string) {
  if (action.includes("refund")) return "返金review更新";
  if (action.includes("admission")) return "入場状態更新";
  if (action.includes("session")) return "Wallet session更新";
  if (action.includes("email")) return "メール配信更新";
  return "チケット状態更新";
}

async function callManagerReadRpc(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
) {
  const projection = await callManagerRpc(client, name, parameters);
  if (projection.action !== "read") throw databaseError();
  return projection;
}

function projectedRows(projection: DbRow, field: string) {
  const value = projection[field];
  if (!Array.isArray(value) || !value.every(isRecord)) throw databaseError();
  return value;
}

async function callManagerRpc(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<TicketManagerRpcResult> {
  let result: Awaited<ReturnType<SupabaseClient["rpc"]>>;
  try {
    result = await client.rpc(name, parameters);
  } catch {
    throw databaseError();
  }
  if (result.error || !isRecord(result.data)) throw databaseError();
  return result.data;
}

async function selectRows(query: PromiseLike<{ data: unknown; error: unknown }>) {
  let result: { data: unknown; error: unknown };
  try {
    result = await query;
  } catch {
    throw databaseError();
  }
  if (result.error || !Array.isArray(result.data) || !result.data.every(isRecord)) {
    throw databaseError();
  }
  return result.data;
}

async function maybeOne(query: PromiseLike<{ data: unknown; error: unknown }>) {
  let result: { data: unknown; error: unknown };
  try {
    result = await query;
  } catch {
    throw databaseError();
  }
  if (result.error || (result.data !== null && !isRecord(result.data))) throw databaseError();
  return result.data;
}

function rejected(reason: string): TicketManagerRpcResult {
  return { action: "rejected", reused: false, reason };
}

function readTicketEnvironment(): TicketEnvironment {
  return readRuntimeEnvironment();
}

function requireClock(value: number) {
  if (!Number.isFinite(value)) throw databaseError();
  return value;
}

function canonicalInstant(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw databaseError();
  return new Date(timestamp).toISOString();
}

function requireCalendarDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw databaseError();
  return value;
}

function requireEnvironment(value: unknown): TicketEnvironment {
  if (value !== "live" && value !== "test") throw databaseError();
  return value;
}

function requirePublicCode(value: unknown) {
  if (typeof value !== "string" || !/^GT-[0-9A-HJ-NP-Z]{10}$/u.test(value)) throw databaseError();
  return value;
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw databaseError();
  }
  return value;
}

function requireString(value: unknown) {
  if (typeof value !== "string") throw databaseError();
  return value;
}

function requireHash(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw databaseError();
  return value;
}

function requireBoundedText(value: unknown, maximum: number) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > maximum) {
    throw databaseError();
  }
  return value;
}

function nullableBoundedText(value: unknown, maximum: number) {
  return value === null || value === undefined ? null : requireBoundedText(value, maximum);
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : requireString(value);
}

function requirePositiveInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw databaseError();
  return value as number;
}

function requireNonNegativeInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw databaseError();
  return value as number;
}

function uniqueStrings(values: readonly unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function databaseError() {
  const error = new Error("TICKET_MANAGER_DATABASE_UNAVAILABLE");
  error.name = "TicketManagerDatabaseError";
  return error;
}

function isRecord(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
