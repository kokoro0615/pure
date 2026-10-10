import { NextResponse } from "next/server";

import { requireServerEnv } from "./env";
import { safeSecretEqual } from "./secretCompare";

export { safeSecretEqual } from "./secretCompare";

/**
 * Shared `Authorization: Bearer <envName>` check used by worker-style routes.
 * Missing configuration fails closed (`requireServerEnv` throws), and the
 * comparison is constant-time.
 */
export function assertSharedSecretBearer(request: Request, envName: string) {
  const expected = requireServerEnv(envName);
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!safeSecretEqual(token, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return null;
}

export function assertWorkerRequest(request: Request) {
  return assertSharedSecretBearer(request, "PURE_WORKER_RUN_SECRET");
}

/**
 * Runtime readback entrance (admin observability routes). Accepts the worker
 * bearer secret; the caller falls back to an admin cookie session when this
 * returns a response. The source's staging-only Vercel OIDC path is dropped —
 * Pure has no Vercel edge, so the bearer is the only machine entrance.
 */
export async function assertRuntimeReadbackRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token && process.env.PURE_WORKER_RUN_SECRET && safeSecretEqual(token, process.env.PURE_WORKER_RUN_SECRET)) {
    return null;
  }

  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
