import { createHash, createHmac } from "node:crypto";

import type { GateCSyntheticScope } from "./gateCSyntheticScope";
import type { VipFloorShadowRouteKind } from "./vipFloorShadowCompare";

export type GateCObservationClassification =
  | "match"
  | "expected_divergence"
  | "snapshot_race"
  | "critical_missing"
  | "critical_value"
  | "critical_error"
  | "privacy_violation";

export function createGateCObservationRecord({
  attemptOrdinal,
  classification,
  comparisonKey,
  latencyMs,
  requestCorrelationId,
  routeKind,
  scope,
  v1Digest,
  v2Digest,
}: {
  attemptOrdinal: number;
  classification: GateCObservationClassification;
  comparisonKey: string;
  latencyMs: number;
  requestCorrelationId: string;
  routeKind: VipFloorShadowRouteKind;
  scope: GateCSyntheticScope;
  v1Digest: string;
  v2Digest: string;
}) {
  if (
    !Number.isInteger(attemptOrdinal) ||
    attemptOrdinal < 1 ||
    Buffer.byteLength(comparisonKey) < 32 ||
    !/^[a-f0-9]{64}$/u.test(v1Digest) ||
    !/^[a-f0-9]{64}$/u.test(v2Digest)
  ) {
    throw new Error("gate_c_observation_input_invalid");
  }
  const requestId = createHash("sha256").update(requestCorrelationId).digest("hex");
  const comparisonId = createHash("sha256")
    .update(`${scope.executionId}\n${scope.cycleId}\n${requestId}\n${routeKind}\n${attemptOrdinal}`)
    .digest("hex");
  const unsigned = {
    schemaVersion: "vip-floor-gate-c-observation.v7r5",
    executionId: scope.executionId,
    cycleId: scope.cycleId,
    requestId,
    comparisonId,
    route: {
      availability: "/api/reservations/availability",
      "seat-availability": "/api/reservations/seat-availability",
      "admin-board": "/api/admin/vip-status",
    }[routeKind],
    writer: {
      availability: "vip_floor_public_availability",
      "seat-availability": "vip_floor_public_seat_availability",
      "admin-board": "vip_floor_admin_board",
    }[routeKind],
    sampleDecision: "accepted",
    v1Digest,
    v2Digest,
    latencyMs: Math.max(0, Math.round(latencyMs)),
    classification,
  };
  return {
    ...unsigned,
    authenticityTag: createHmac("sha256", comparisonKey)
      .update(canonicalJson(unsigned))
      .digest("hex"),
  };
}

export function isGateCCriticalObservation(classification: GateCObservationClassification) {
  return !["match", "expected_divergence"].includes(classification);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([name, child]) => `${JSON.stringify(name)}:${canonicalJson(child)}`)
    .join(",")}}`;
}
