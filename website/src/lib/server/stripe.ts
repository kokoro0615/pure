import Stripe from "stripe";

import { requireServerEnv } from "./env";
import { FakeStripe } from "./providers/fakeStripe";
import { readPureProfile } from "./pureRuntime";

export const STRIPE_API_VERSION = "2026-04-22.dahlia";

let stripeClient: Stripe | FakeStripe | undefined;

function resolveClient(): Stripe | FakeStripe {
  const profile = readPureProfile();
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (profile === "local-mock") {
    // Default local provider is the deterministic fake; a real test key is an
    // explicit opt-in and still works. Live keys are never allowed locally.
    if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) {
      throw new Error("stripe_key_forbidden: live Stripe key cannot run in local-mock profile");
    }
    if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) {
      return new Stripe(key, {
        apiVersion: STRIPE_API_VERSION as never,
        appInfo: { name: "pure-osaka-platform", version: "0.1.0" },
      });
    }
    return new FakeStripe();
  }

  if (profile === "pure-dev") {
    // The connected development profile always uses real TEST credentials.
    if (!key?.startsWith("sk_test_") && !key?.startsWith("rk_test_")) {
      throw new Error("stripe_key_invalid: pure-dev requires a Stripe test key");
    }
    return new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
      apiVersion: STRIPE_API_VERSION as never,
      appInfo: { name: "pure-osaka-platform", version: "0.1.0" },
    });
  }

  // production
  const prodKey = requireServerEnv("STRIPE_SECRET_KEY");
  if (!prodKey.startsWith("sk_live_") && !prodKey.startsWith("rk_live_")) {
    throw new Error("stripe_key_invalid: production profile requires a live Stripe key");
  }
  return new Stripe(prodKey, {
    apiVersion: STRIPE_API_VERSION as never,
    appInfo: { name: "pure-osaka-platform", version: "0.1.0" },
  });
}

export function getStripeClient(): Stripe {
  stripeClient ??= resolveClient();
  // FakeStripe implements the Stripe-surface subset used by the ported code;
  // it is structurally compatible for those call sites.
  return stripeClient as Stripe;
}

/** True when the active provider is the deterministic local fake. */
export function isFakeStripeClient(): boolean {
  return stripeClient instanceof FakeStripe;
}

export function stripeRequestOptions(stripeAccountId?: string | null, idempotencyKey?: string | null) {
  return {
    ...(stripeAccountId ? { stripeAccount: stripeAccountId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}
