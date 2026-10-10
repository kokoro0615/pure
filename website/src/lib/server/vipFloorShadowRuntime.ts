import "server-only";

import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { after } from "next/server";

import { isFeatureEnabled } from "./featureFlags";
import {
  createGateCObservationRecord,
  isGateCCriticalObservation,
  type GateCObservationClassification,
} from "./gateCObservation";
import {
  readGateCSyntheticScopeFromRequest,
  type GateCSyntheticScope,
} from "./gateCSyntheticScope";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  buildVipFloorShadowEvidence,
  canonicalizeAdminV1,
  canonicalizeAdminV2,
  canonicalizePublicAvailability,
  canonicalizePublicSeatAvailability,
  compareVipFloorCanonical,
  criticalShadowError,
  vipFloorShadowDigest,
  type VipFloorShadowRouteKind,
  type VipFloorShadowResult,
} from "./vipFloorShadowCompare";
import type { VipFloorPublicCompatibilityMode } from "./vipFloorPublicCompatibility";

let activeSamples = 0;
const MAX_CONCURRENT_SAMPLES = 2;

const COLLECTOR_CORRELATION_HEADER = "x-pure-vip-floor-shadow-correlation";
const COLLECTOR_ATTEMPT_HEADER = "x-pure-vip-floor-shadow-attempt";
const COLLECTOR_SIGNATURE_HEADER = "x-pure-vip-floor-shadow-signature";

type VipFloorShadowRequestContext = {
  attemptOrdinal: number;
  collectorRequested: boolean;
  collectorRequestValid: boolean;
  requestCorrelationId: string;
  routeKind: VipFloorShadowRouteKind;
  syntheticScope: GateCSyntheticScope | null;
};

type VipFloorShadowCompletion = {
  businessDate: string | null;
  durationMs: number;
  results: VipFloorShadowResult[];
  servedContract: "v1" | "v2" | "none";
  v1Digest: string;
  v2Digest: string;
};

export function createVipFloorShadowRequestContext(
  request: Request,
  routeKind: VipFloorShadowRouteKind,
): VipFloorShadowRequestContext {
  const rawCorrelation = request.headers.get(COLLECTOR_CORRELATION_HEADER);
  const rawAttempt = request.headers.get(COLLECTOR_ATTEMPT_HEADER);
  const rawSignature = request.headers.get(COLLECTOR_SIGNATURE_HEADER);
  const headersPresent = rawCorrelation !== null || rawAttempt !== null || rawSignature !== null;
  const correlationValid = rawCorrelation !== null && /^[a-f0-9]{32,64}$/u.test(rawCorrelation);
  const attemptValid = rawAttempt !== null && /^(?:[1-9]\d{0,6})$/u.test(rawAttempt);
  const collectorRequested = headersPresent && authenticateCollectorRequest({
    rawAttempt,
    rawCorrelation,
    rawSignature,
    routeKind,
  });
  let syntheticScope: GateCSyntheticScope | null = null;
  let syntheticScopeValid = true;
  try {
    syntheticScope = readGateCSyntheticScopeFromRequest(request);
  } catch {
    syntheticScopeValid = false;
  }

  return {
    attemptOrdinal: attemptValid ? Number.parseInt(rawAttempt, 10) : 1,
    collectorRequested,
    collectorRequestValid:
      syntheticScopeValid &&
      (!headersPresent || (collectorRequested && correlationValid && attemptValid)),
    requestCorrelationId: correlationValid ? rawCorrelation : randomUUID().replaceAll("-", ""),
    routeKind,
    syntheticScope,
  };
}

export function schedulePublicVipFloorShadowComparison({
  businessDate,
  guestCount,
  kind,
  requestContext,
  servedContract,
  servedRows,
}: {
  businessDate: string | null;
  guestCount: number | null;
  kind: "availability" | "seat-availability";
  requestContext: VipFloorShadowRequestContext;
  servedContract: VipFloorPublicCompatibilityMode;
  servedRows: unknown;
}) {
  scheduleSample(requestContext, async () => {
    const startedAt = performance.now();
    const supabase = createSupabaseAdminClient();
    const comparisonContract = servedContract === "v8" ? "v1" : "v2";
    const rpcName = kind === "availability"
      ? `calculate_public_availability_${comparisonContract}`
      : `calculate_public_seat_availability_${comparisonContract}`;
    const { data, error } = await supabase.rpc(rpcName, {
      p_business_date: businessDate,
      p_guest_count: guestCount,
    });
    const servedCanonical = kind === "availability"
      ? canonicalizePublicAvailability(servedRows)
      : canonicalizePublicSeatAvailability(servedRows);
    const comparisonCanonical = kind === "availability"
      ? canonicalizePublicAvailability(data)
      : canonicalizePublicSeatAvailability(data);
    const result = error
      ? criticalShadowError()
      : compareVipFloorCanonical(
          servedCanonical,
          comparisonCanonical,
        );
    const servedIsV2 = servedContract === "v8";
    return {
      businessDate,
      durationMs: performance.now() - startedAt,
      results: [result],
      servedContract: servedContract === "v8" ? "v2" : "v1",
      v1Digest: vipFloorShadowDigest(servedIsV2 ? comparisonCanonical : servedCanonical),
      v2Digest: vipFloorShadowDigest(servedIsV2 ? servedCanonical : comparisonCanonical),
    };
  });
}

export function scheduleAdminVipFloorShadowComparison({
  actorAdminId,
  businessDate,
  requestContext,
  servedPayload,
}: {
  actorAdminId: string;
  businessDate: string;
  requestContext: VipFloorShadowRequestContext;
  servedPayload: unknown;
}) {
  scheduleSample(requestContext, async () => {
    const startedAt = performance.now();
    const { data, error } = await createSupabaseAdminClient().rpc(
      "get_admin_vip_floor_board_v8",
      {
        p_actor_admin_id: actorAdminId,
        p_business_date: businessDate,
      },
    );
    const v1Canonical = canonicalizeAdminV1(servedPayload);
    const v2Canonical = canonicalizeAdminV2(data);
    const result = error
      ? criticalShadowError()
      : compareVipFloorCanonical(
          v1Canonical,
          v2Canonical,
        );
    return {
      businessDate,
      durationMs: performance.now() - startedAt,
      results: [result],
      servedContract: "v1",
      v1Digest: vipFloorShadowDigest(v1Canonical),
      v2Digest: vipFloorShadowDigest(v2Canonical),
    };
  });
}

function scheduleSample(
  requestContext: VipFloorShadowRequestContext,
  task: () => Promise<VipFloorShadowCompletion>,
) {
  if (!requestContext.collectorRequestValid) {
    emitScheduleOutcome(requestContext, "rejected");
    return;
  }
  const samplingEnabled = shouldSample();
  if (!samplingEnabled) {
    emitScheduleOutcome(requestContext, "sampled_out");
    return;
  }
  if (!process.env.VIP_FLOOR_SHADOW_COMPARE_KEY) {
    emitScheduleOutcome(requestContext, "missing_key");
    return;
  }
  if (activeSamples >= MAX_CONCURRENT_SAMPLES) {
    emitScheduleOutcome(requestContext, "concurrency_skip");
    return;
  }

  emitScheduleOutcome(requestContext, "scheduled");
  activeSamples += 1;
  try {
    after(async () => {
      try {
        const completion = await task();
        emitRuntimeEvidence({
          ...completion,
          completionOutcome: "completed",
          requestContext,
        });
      } catch {
        emitRuntimeEvidence({
          businessDate: null,
          completionOutcome: "failed",
          durationMs: 0,
          requestContext,
          results: [criticalShadowError()],
          servedContract: "none",
          v1Digest: createHash("sha256").update("failed-v1").digest("hex"),
          v2Digest: createHash("sha256").update("failed-v2").digest("hex"),
        });
      } finally {
        activeSamples -= 1;
      }
    });
  } catch {
    try {
      emitRuntimeEvidence({
        businessDate: null,
        completionOutcome: "failed",
        durationMs: 0,
        requestContext,
        results: [criticalShadowError()],
        servedContract: "none",
        v1Digest: createHash("sha256").update("failed-v1").digest("hex"),
        v2Digest: createHash("sha256").update("failed-v2").digest("hex"),
      });
    } finally {
      activeSamples -= 1;
    }
  }
}

function shouldSample() {
  if (!isFeatureEnabled("FEATURE_VIP_FLOOR_V2_SHADOW_COMPARE_ENABLED")) return false;
  const raw = process.env.VIP_FLOOR_V2_SHADOW_SAMPLE_RATE_BPS;
  const basisPoints = raw && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : 0;
  if (basisPoints <= 0) return false;
  return randomInt(10_000) < Math.min(basisPoints, 10_000);
}

function emitRuntimeEvidence({
  businessDate,
  completionOutcome,
  durationMs,
  requestContext,
  results,
  servedContract,
  v1Digest,
  v2Digest,
}: {
  businessDate: string | null;
  completionOutcome: "completed" | "failed";
  durationMs: number;
  requestContext: VipFloorShadowRequestContext;
  results: VipFloorShadowResult[];
  servedContract: "v1" | "v2" | "none";
  v1Digest: string;
  v2Digest: string;
}) {
  const comparisonKey = process.env.VIP_FLOOR_SHADOW_COMPARE_KEY;
  if (!comparisonKey) return;
  const evidence = buildVipFloorShadowEvidence({
    businessDate,
    completionOrdinal: requestContext.attemptOrdinal,
    completionOutcome,
    comparisonKey,
    durationMs,
    mode: "runtime-sample",
    requestCorrelationId: requestContext.requestCorrelationId,
    routeKind: requestContext.routeKind,
    results,
    scheduleAttempt: requestContext.attemptOrdinal,
    servedContract,
  });
  const criticalCount =
    evidence.counts.criticalMissing + evidence.counts.criticalValue +
    evidence.counts.criticalError + evidence.counts.privacyViolation;
  (criticalCount > 0 ? console.warn : console.info)(
    "VIP Floor shadow comparison",
    evidence,
  );
  emitGateCStrictObservation({
    durationMs,
    requestContext,
    results,
    v1Digest,
    v2Digest,
  });
}

function emitGateCStrictObservation({
  durationMs,
  requestContext,
  results,
  v1Digest,
  v2Digest,
}: {
  durationMs: number;
  requestContext: VipFloorShadowRequestContext;
  results: VipFloorShadowResult[];
  v1Digest: string;
  v2Digest: string;
}) {
  const scope = requestContext.syntheticScope;
  const key = process.env.VIP_FLOOR_SHADOW_COMPARE_KEY;
  if (!scope || !key) return;
  const record = createGateCObservationRecord({
    attemptOrdinal: requestContext.attemptOrdinal,
    classification: strictClassification(results),
    comparisonKey: key,
    latencyMs: durationMs,
    requestCorrelationId: requestContext.requestCorrelationId,
    routeKind: requestContext.routeKind,
    scope,
    v1Digest,
    v2Digest,
  });
  (isGateCCriticalObservation(record.classification) ? console.warn : console.info)(
    "VIP Floor Gate C observation",
    record,
  );
}

function strictClassification(results: VipFloorShadowResult[]): GateCObservationClassification {
  if (results.every((result) => result.classification === "equal")) return "match";
  if (results.every((result) => ["equal", "expected_v2_rule"].includes(result.classification))) {
    return "expected_divergence";
  }
  const critical = results.find((result) =>
    [
      "snapshot_race",
      "critical_missing",
      "critical_value",
      "critical_error",
      "privacy_violation",
    ].includes(result.classification),
  )?.classification;
  return critical === "snapshot_race" ||
    critical === "critical_missing" ||
    critical === "critical_value" ||
    critical === "critical_error" ||
    critical === "privacy_violation"
    ? critical
    : "critical_error";
}

function emitScheduleOutcome(
  requestContext: VipFloorShadowRequestContext,
  outcome: "concurrency_skip" | "missing_key" | "rejected" | "sampled_out" | "scheduled",
) {
  if (!requestContext.collectorRequested) return;
  console.info("VIP Floor shadow schedule", {
    schemaVersion: 2,
    mode: "runtime-sample",
    correlationSha256: createHash("sha256")
      .update(requestContext.requestCorrelationId)
      .digest("hex"),
    routeKind: requestContext.routeKind,
    requestKind: requestContext.routeKind,
    scheduleAttempt: requestContext.attemptOrdinal,
    attemptOrdinal: requestContext.attemptOrdinal,
    outcome,
  });
}

function authenticateCollectorRequest({
  rawAttempt,
  rawCorrelation,
  rawSignature,
  routeKind,
}: {
  rawAttempt: string | null;
  rawCorrelation: string | null;
  rawSignature: string | null;
  routeKind: VipFloorShadowRouteKind;
}) {
  const key = process.env.VIP_FLOOR_SHADOW_COMPARE_KEY;
  if (!key || !rawSignature || !/^[a-f0-9]{64}$/u.test(rawSignature)) return false;
  const expected = createHmac("sha256", key)
    .update(`${rawCorrelation ?? ""}\n${rawAttempt ?? ""}\n${routeKind}`)
    .digest();
  const received = Buffer.from(rawSignature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
