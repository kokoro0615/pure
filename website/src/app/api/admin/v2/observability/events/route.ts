import { NextResponse } from "next/server";

import {
  isHttpBodyError,
  assertAdminCookieMutation,
  readBoundedJsonObject,
} from "@/lib/server/httpBoundary";
import {
  createVipFloorErrorResponse,
  requireVipFloorV2AdminSession,
} from "@/lib/server/vipFloorV2";
import { recordVipManagerMetric } from "@/lib/server/vipManagerObservability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Session-cookie mutation: browser requests must be same-origin JSON.
  const boundary = assertAdminCookieMutation(request);
  if (!boundary.ok) {
    return NextResponse.json(
      { ok: false, error: boundary.error },
      { status: boundary.status },
    );
  }

  const auth = await requireVipFloorV2AdminSession(request);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "owner") {
    return createVipFloorErrorResponse({
      code: "FORBIDDEN",
      details: { capability: "owner" },
    });
  }
  let body: Record<string, unknown> | null;
  try {
    body = await readBoundedJsonObject(request, 4_096);
  } catch (error) {
    if (isHttpBodyError(error) && (error.code === "body_too_large" || error.code === "declared_length_too_large")) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_COMMAND" } },
        { status: 413 },
      );
    }
    body = null;
  }
  const event = body?.event === "realtime_gap" || body?.event === "realtime_unavailable"
    ? body.event
    : null;
  const businessDate = typeof body?.businessDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/u.test(body.businessDate)
    ? body.businessDate
    : null;
  const gapSize = typeof body?.gapSize === "number"
    && Number.isSafeInteger(body.gapSize)
    && body.gapSize >= 0
    && body.gapSize <= 1_000_000
    ? body.gapSize
    : null;
  if (!event || !businessDate || (event === "realtime_gap" && gapSize === null)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_COMMAND" } },
      { status: 400 },
    );
  }
  await recordVipManagerMetric({
    metricName: event,
    outcome: "observed",
    actionName: event,
    requestId: auth.actor.requestId,
    dimensions: {
      day: businessDate,
      ...(event === "realtime_gap" ? { gap: gapSize } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
