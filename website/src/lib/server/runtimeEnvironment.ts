import "server-only";

import { readPureEnvironment, readPureProfile, type PureEnvironment } from "./pureRuntime";

export type RuntimeEnvironment = PureEnvironment;

/**
 * Runtime money environment.
 *
 * Pure-local runs always resolve to `test`. `live` requires the production
 * profile; when a real Stripe secret key is configured its prefix must agree
 * with the resolved environment so a test key can never write live-scoped
 * records (and vice versa).
 */
export function readRuntimeEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): RuntimeEnvironment {
  const environment = readPureEnvironment(env);
  const stripeSecret = env.STRIPE_SECRET_KEY?.trim();
  if ((stripeSecret?.startsWith("sk_live_") || stripeSecret?.startsWith("rk_live_")) && environment !== "live") {
    throw new Error("runtime_environment_conflict: live Stripe key with non-live environment");
  }
  if ((stripeSecret?.startsWith("sk_test_") || stripeSecret?.startsWith("rk_test_")) && environment === "live") {
    throw new Error("runtime_environment_conflict: test Stripe key with live environment");
  }
  return environment;
}

export function readRuntimeEnvironmentWithSource(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { environment: RuntimeEnvironment; source: "env" | "profile" } {
  const environment = readRuntimeEnvironment(env);
  return { environment, source: env.PURE_ENVIRONMENT?.trim() ? "env" : "profile" };
}

export function assertRuntimeEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): RuntimeEnvironment {
  return readRuntimeEnvironment(env);
}

export function isLocalRuntime(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return readPureProfile(env) === "local-mock";
}
