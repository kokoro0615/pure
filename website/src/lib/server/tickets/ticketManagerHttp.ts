import "server-only";

import { after, NextResponse } from "next/server";

import { isFeatureEnabled } from "../featureFlags";
import { assertAdminCookieMutation } from "../httpBoundary";
import { getTicketWalletReadiness } from "../ticketWalletReadiness";
import {
  createVipFloorErrorResponse,
  requireVipFloorV2AdminSession,
} from "../vipFloorV2";
import {
  createTicketManagerOperations,
  ticketManagerFailure,
  ticketManagerPrivateHeaders,
  type TicketManagerFailure,
} from "./ticketManagerOperations";
import { createTicketManagerProductionRepository } from "./ticketManagerProductionRuntime";
import { runTicketTransactionalEmailSpecificJob } from "./ticketWalletProductionRuntime";

type TicketManagerCapability = "manager" | "refund" | "email";

let productionOperations: ReturnType<typeof createProductionOperations> | null = null;

export async function requireTicketManagerOwner(request: Request) {
  // Ticket-manager routes ride the same admin session cookie as the rest of
  // the console; a browser-originated mutation must be same-origin (or a
  // configured console origin) with a JSON body. Reads keep the Origin /
  // Fetch-Metadata checks but do not require a JSON content type.
  const boundary = assertAdminCookieMutation(request, {
    requireJsonBody: request.method !== "GET" && request.method !== "HEAD",
  });
  if (!boundary.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: boundary.error },
        { status: boundary.status },
      ),
    };
  }

  const auth = await requireVipFloorV2AdminSession(request);
  if (!auth.ok) return auth;
  if (auth.actor.role !== "owner") {
    return {
      ok: false as const,
      response: createVipFloorErrorResponse({
        code: "FORBIDDEN",
        details: { capability: "owner" },
      }),
    };
  }
  return auth;
}

export function requireTicketManagerCapability(capability: TicketManagerCapability) {
  const readiness = getTicketWalletReadiness();
  const managerEnabled = isFeatureEnabled("FEATURE_TICKET_MANAGER_OPERATIONS_ENABLED");
  const refundEnabled = isFeatureEnabled("FEATURE_TICKET_REFUND_REVIEW_ENABLED");
  if (capability === "refund") {
    return refundEnabled && readiness.refundReview.ok
      ? { ok: true as const }
      : { ok: false as const, response: ticketManagerErrorResponse(ticketManagerFailure("capability_disabled"), 404) };
  }
  if (!managerEnabled || !readiness.managerOperations.ok) {
    return { ok: false as const, response: ticketManagerErrorResponse(ticketManagerFailure("capability_disabled"), 404) };
  }
  if (capability === "email" && !readiness.transactionalEmailDrain.ok) {
    return {
      ok: false as const,
      response: ticketManagerErrorResponse(
        ticketManagerFailure(
          "provider_disabled",
          null,
          "メールproviderのactivation/readinessを確認してください。",
        ),
        503,
      ),
    };
  }
  return { ok: true as const };
}

export function getTicketManagerOperations() {
  productionOperations ??= createProductionOperations();
  return productionOperations;
}

export function ticketManagerJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: ticketManagerPrivateHeaders(),
  });
}

export function ticketManagerErrorResponse(
  failure: TicketManagerFailure,
  status = statusForFailure(failure.error),
) {
  return ticketManagerJson(failure, status);
}

export function ticketManagerOperationResponse(
  result: Awaited<ReturnType<ReturnType<typeof createProductionOperations>["revokeSession"]>>,
) {
  return result.ok ? ticketManagerJson(result) : ticketManagerErrorResponse(result);
}

export function ticketManagerServerFailure() {
  return ticketManagerErrorResponse(
    ticketManagerFailure(
      "operation_failed",
      null,
      "状態を再読込してから再試行してください。",
    ),
    500,
  );
}

function createProductionOperations() {
  return createTicketManagerOperations(createTicketManagerProductionRepository({
    emailProviderState() {
      return getTicketWalletReadiness().transactionalEmailDrain.ok ? "ready" : "degraded";
    },
    scheduleEmailJob(jobId) {
      after(async () => {
        try {
          await runTicketTransactionalEmailSpecificJob(jobId);
        } catch {
          // Durable outbox recovery remains authoritative.
        }
      });
    },
  }), () => Date.now());
}

function statusForFailure(error: TicketManagerFailure["error"]) {
  if (error === "invalid_request") return 400;
  if (error === "not_found") return 404;
  if (error === "capability_disabled") return 404;
  if (error === "provider_disabled") return 503;
  if (error === "operation_failed") return 500;
  return 409;
}
