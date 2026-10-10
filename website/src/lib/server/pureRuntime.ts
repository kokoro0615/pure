import "server-only";

/**
 * Pure runtime profile — the single source of truth for how this deployment
 * resolves provider boundaries, origins, and environment scoping.
 *
 * - `local-mock`: dedicated local Postgres + deterministic fake Stripe +
 *   notification capture + test Turnstile adapter. Real DB/HTTP/auth/worker
 *   paths; provider calls are deterministic fakes.
 * - `pure-dev`: verified Pure development environment. Real providers ONLY
 *   when their credentials are explicitly configured — no silent fake
 *   fallback when a real provider was selected but credentials are absent.
 * - `production`: reserved; never started locally.
 */

export type PureProfile = "local-mock" | "pure-dev" | "production";
export type PureEnvironment = "test" | "live";

export function readPureProfile(env: Readonly<Record<string, string | undefined>> = process.env): PureProfile {
  // A hosted deployment (Vercel sets VERCEL_ENV) must name its profile. Only an
  // unhosted local process may default to the mock, whose Postgres shim, fake
  // Stripe and notification capture must never serve real traffic.
  const hosted = Boolean(env.VERCEL_ENV?.trim());
  const raw = env.PURE_PROFILE?.trim() || (hosted ? "" : "local-mock");
  if (!raw) {
    throw new Error("pure_profile_missing");
  }
  if (raw === "local-mock" || raw === "pure-dev" || raw === "production") {
    if (hosted && raw === "local-mock") {
      throw new Error("pure_profile_local_mock_hosted");
    }
    if (env.VERCEL_ENV?.trim() === "production" && raw !== "production") {
      throw new Error("pure_profile_production_required");
    }
    return raw;
  }
  throw new Error(`pure_profile_invalid:${raw}`);
}

export function isProductionProfile(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return readPureProfile(env) === "production";
}

/** Store identity — scopes idempotency + audit so stores never collide. */
export function readPureStoreId(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const raw = env.PURE_STORE_ID?.trim();
  return raw && /^[a-z0-9][a-z0-9-]{1,32}$/u.test(raw) ? raw : "pure-osaka";
}

/**
 * Money environment for durable records. `live` is only reachable in the
 * production profile with a live Stripe key; every local/dev profile is
 * `test`, which is also what the schema's environment column expects.
 */
export function readPureEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): PureEnvironment {
  const profile = readPureProfile(env);
  const configured = env.PURE_ENVIRONMENT?.trim();
  if (profile === "production") {
    // The production deployment records live money only; `test` remains for a
    // production-profile rehearsal that is not the Vercel production target.
    if (configured === "test" && env.VERCEL_ENV?.trim() === "production") {
      throw new Error("pure_environment_conflict: production deployment cannot record test environment");
    }
    return configured === "test" ? "test" : "live";
  }
  if (configured && configured !== "test") {
    throw new Error("pure_environment_conflict: non-production profile cannot record live environment");
  }
  return "test";
}

/** Idempotency/audit scope prefix shared by every boundary. */
export function pureScopePrefix(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return `${readPureStoreId(env)}:${readPureEnvironment(env)}`;
}
