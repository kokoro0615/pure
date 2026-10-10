import "server-only";

import { createSupabaseAdminClient } from "./supabaseAdmin";

export type VipManagerMetricName =
  | "board_read"
  | "command"
  | "command_error"
  | "outbox_dead"
  | "realtime_gap"
  | "realtime_unavailable";

export async function recordVipManagerMetric(input: {
  metricName: VipManagerMetricName;
  outcome: "success" | "rejected" | "error" | "observed";
  durationMs?: number | null;
  actionName?: string | null;
  requestId?: string | null;
  dimensions?: Record<string, string | number | boolean | null>;
}) {
  try {
    await createSupabaseAdminClient().rpc("record_vip_manager_metric_v15", {
      p_metric_name: input.metricName,
      p_outcome: input.outcome,
      p_duration_ms: input.durationMs == null
        ? null
        : Math.max(0, Math.min(600_000, Math.round(input.durationMs))),
      p_action_name: input.actionName ?? null,
      p_request_id: input.requestId ?? null,
      p_dimensions: input.dimensions ?? {},
    }).abortSignal(AbortSignal.timeout(500));
  } catch {
    // Telemetry must never change an operational command outcome.
  }
}
