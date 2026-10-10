import { createHmac, randomUUID } from "node:crypto";

import "server-only";

/**
 * Deterministic local Stripe replacement for `PURE_PROFILE=local-mock`.
 *
 * Every object id carries a `*_fake_*` prefix so fake provider state can never
 * be confused with (or reconciled against) real Stripe objects. State lives in
 * a globalThis-backed map shared across the dev server's per-route module
 * graphs — intentionally NOT durable: a dev-server restart means a new
 * checkout.
 *
 * Test controls baked into ids:
 * - payment_method `pm_fake_card_ok`        → charges succeed
 * - payment_method `pm_fake_card_decline`   → charges raise a card decline
 * - any other `pm_fake_*`                   → charges succeed (default allow)
 * - setup_intent `seti_fake_*`              → status "succeeded"
 */

type Json = Record<string, unknown>;

type FakeCheckoutSession = {
  id: string;
  object: "checkout.session";
  status: "open" | "complete" | "expired";
  mode: string;
  ui_mode?: string;
  client_reference_id: string | null;
  client_secret: string | null;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  setup_intent: string | Json | null;
  customer: string | null;
  customer_details: Json | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Json;
  expires_at: number;
  livemode: false;
};

type FakePaymentIntent = {
  id: string;
  object: "payment_intent";
  status: string;
  amount: number;
  currency: string;
  customer: string | null;
  payment_method: string | null;
  client_secret: string;
  metadata: Json;
  livemode: false;
  latest_charge: string | null;
};

type FakeCustomer = {
  id: string;
  object: "customer";
  email: string | null;
  phone: string | null;
  name: string | null;
  metadata: Json;
  livemode: false;
  deleted?: boolean;
};

function fakeId(prefix: string): string {
  return `${prefix}_fake_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Mirror Stripe's `expand: [...]` behaviour for the fields the ported code
 * expands (currently `setup_intent` on checkout sessions). Stored state keeps
 * the id string; expansion happens at response time only.
 */
function maybeExpandSession(session: FakeCheckoutSession, params: Json) {
  const expand = Array.isArray(params.expand) ? (params.expand as string[]) : [];
  if (!expand.includes("setup_intent") || typeof session.setup_intent !== "string") {
    return session;
  }
  return {
    ...session,
    setup_intent: fakeSetupIntentObject(session.setup_intent),
  };
}

function fakeSetupIntentObject(id: string) {
  return {
    id,
    object: "setup_intent",
    status: "requires_payment_method",
    payment_method: null,
    customer: null,
    client_secret: `${id}_secret_${fakeId("ck").slice(8)}`,
    metadata: {},
    livemode: false,
  };
}

/**
 * Shared store. Exported so the local-mock dev route can mark a session paid
 * and synthesize the corresponding webhook event through the real settlement
 * path. Backed by globalThis because the dev server compiles each route as a
 * separate module graph — a module-level Map would be per-route state and a
 * session created in /api/tickets/checkout would be invisible here.
 */
export const fakeStripeStore = (() => {
  const g = globalThis as {
    __pureFakeStripeStore?: {
      sessions: Map<string, FakeCheckoutSession>;
      paymentIntents: Map<string, FakePaymentIntent>;
      paymentMethods: Map<string, Json>;
      customers: Map<string, FakeCustomer>;
      refunds: Map<string, Json>;
    };
  };
  g.__pureFakeStripeStore ??= {
    sessions: new Map(),
    paymentIntents: new Map(),
    paymentMethods: new Map(),
    customers: new Map(),
    refunds: new Map(),
  };
  g.__pureFakeStripeStore.paymentMethods ??= new Map();
  return g.__pureFakeStripeStore;
})();

export class FakeStripeError extends Error {
  readonly type = "card_error";
  readonly code: string;
  readonly decline_code?: string;
  readonly statusCode = 402;

  constructor(code: string, message: string, declineCode?: string) {
    super(message);
    this.name = "FakeStripeError";
    this.code = code;
    this.decline_code = declineCode;
  }
}

export class FakeStripe {
  readonly isFake = true as const;

  readonly accounts = {
    retrieveCurrent: async (_params?: Json, _opts?: Json) => ({
      id: "acct_fake_pure_local",
      object: "account",
      charges_enabled: true,
      payouts_enabled: true,
      livemode: false,
      country: "JP",
      default_currency: "jpy",
      email: "pureosaka2005@gmail.com",
    }),
  };

  readonly webhookEndpoints = {
    list: async (_params?: Json, _opts?: Json) => ({
      object: "list",
      data: [
        {
          id: "we_fake_pure_local",
          object: "webhook_endpoint",
          url: "http://localhost:3101/api/stripe/webhook",
          status: "enabled",
          enabled_events: ["*"],
          livemode: false,
        },
      ],
      has_more: false,
    }),
  };

  readonly checkout = {
    sessions: {
      create: async (params: Json = {}, _opts?: Json): Promise<FakeCheckoutSession> => {
        // `cs_test_fake_*` satisfies the same `cs_test_*` shape the ported
        // runtime validates for test-mode Sessions while staying visibly fake.
        const id = fakeId("cs_test");
        const lineItems = (params.line_items as Json[] | undefined) ?? [];
        const amountTotal = lineItems.reduce((sum: number, item) => {
          const priceData = (item.price_data as Json | undefined) ?? {};
          const unit = Number(priceData.unit_amount ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + (Number.isFinite(unit * qty) ? unit * qty : 0);
        }, 0) || null;
        const mode = typeof params.mode === "string" ? params.mode : "payment";
        const requestedExpiry = Number(params.expires_at);
        const session: FakeCheckoutSession = {
          id,
          object: "checkout.session",
          status: "open",
          mode,
          ui_mode: typeof params.ui_mode === "string" ? params.ui_mode : undefined,
          client_reference_id: typeof params.client_reference_id === "string"
            ? params.client_reference_id
            : null,
          client_secret: `${id}_secret_${fakeId("ck").slice(8)}`,
          // Hosted-page URL shape the runtime validates for open Sessions.
          url: mode === "payment" ? `https://checkout.stripe.com/c/pay/${id}` : null,
          payment_status: "unpaid",
          payment_intent: mode === "payment" ? fakeId("pi") : null,
          setup_intent: mode === "setup" ? fakeId("seti") : null,
          customer: typeof params.customer === "string" ? params.customer : null,
          customer_details: null,
          amount_total: amountTotal,
          currency: typeof params.currency === "string" ? params.currency
            : (lineItems[0]?.price_data as Json | undefined)?.currency as string | null ?? "jpy",
          metadata: (params.metadata as Json | undefined) ?? {},
          expires_at: Number.isSafeInteger(requestedExpiry) && requestedExpiry > nowSeconds()
            ? requestedExpiry
            : nowSeconds() + 30 * 60,
          livemode: false,
        };
        if (session.payment_intent) {
          fakeStripeStore.paymentIntents.set(session.payment_intent, {
            id: session.payment_intent,
            object: "payment_intent",
            status: "requires_payment_method",
            amount: amountTotal ?? 0,
            currency: session.currency ?? "jpy",
            customer: session.customer,
            payment_method: null,
            client_secret: `${session.payment_intent}_secret_${fakeId("ck").slice(8)}`,
            metadata: (params.payment_intent_data as Json | undefined)?.metadata as Json ?? {},
            livemode: false,
            latest_charge: null,
          });
        }
        fakeStripeStore.sessions.set(id, session);
        return maybeExpandSession(session, params);
      },
      retrieve: async (id: string, _params?: Json, _opts?: Json) => {
        const session = fakeStripeStore.sessions.get(id);
        if (!session) {
          throw new FakeStripeError("resource_missing", `No such checkout session: ${id}`);
        }
        if (session.status === "open" && session.expires_at < nowSeconds()) {
          session.status = "expired";
        }
        return maybeExpandSession(session, _params ?? {});
      },
      expire: async (id: string, _params?: Json, _opts?: Json) => {
        const session = fakeStripeStore.sessions.get(id);
        if (!session) {
          throw new FakeStripeError("resource_missing", `No such checkout session: ${id}`);
        }
        session.status = "expired";
        return session;
      },
      list: async (params: Json = {}, _opts?: Json) => {
        const limit = Number(params.limit ?? 10);
        const paymentIntent = typeof params.payment_intent === "string" ? params.payment_intent : null;
        let data = [...fakeStripeStore.sessions.values()];
        if (paymentIntent) {
          data = data.filter((s) => s.payment_intent === paymentIntent);
        }
        return { object: "list", data: data.slice(0, limit), has_more: data.length > limit };
      },
    },
  };

  readonly paymentIntents = {
    create: async (params: Json = {}, _opts?: Json): Promise<FakePaymentIntent> => {
      const paymentMethod = typeof params.payment_method === "string" ? params.payment_method : null;
      if (params.confirm === true && paymentMethod === "pm_fake_card_decline") {
        throw new FakeStripeError("card_declined", "Your card was declined.", "generic_decline");
      }
      const intent: FakePaymentIntent = {
        id: fakeId("pi"),
        object: "payment_intent",
        status: params.confirm === true ? "succeeded" : "requires_confirmation",
        amount: Number(params.amount ?? 0),
        currency: typeof params.currency === "string" ? params.currency : "jpy",
        customer: typeof params.customer === "string" ? params.customer : null,
        payment_method: paymentMethod,
        client_secret: `${fakeId("pi")}_secret_${fakeId("ck").slice(8)}`,
        metadata: (params.metadata as Json | undefined) ?? {},
        livemode: false,
        latest_charge: params.confirm === true ? fakeId("ch") : null,
      };
      fakeStripeStore.paymentIntents.set(intent.id, intent);
      return intent;
    },
    retrieve: async (id: string, _params?: Json, _opts?: Json) => {
      const intent = fakeStripeStore.paymentIntents.get(id);
      if (!intent) {
        throw new FakeStripeError("resource_missing", `No such payment intent: ${id}`);
      }
      return intent;
    },
  };

  readonly paymentMethods = {
    retrieve: async (id: string, _opts?: Json) => {
      if (!id.startsWith("pm_fake_")) {
        throw new FakeStripeError("resource_missing", `No such payment method: ${id}`);
      }
      const stored = fakeStripeStore.paymentMethods.get(id) as
        | { customer?: string | null }
        | undefined;
      return {
        id,
        object: "payment_method",
        type: "card",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, funding: "credit", country: "JP" },
        customer: stored?.customer ?? null,
        livemode: false,
      };
    },
  };

  readonly setupIntents = {
    retrieve: async (id: string, _params?: Json, _opts?: Json) => ({
      id,
      object: "setup_intent",
      status: id.startsWith("seti_fake_") ? "succeeded" : "requires_payment_method",
      payment_method: "pm_fake_card_ok",
      customer: null,
      metadata: {},
      livemode: false,
    }),
  };

  readonly customers = {
    create: async (params: Json = {}, _opts?: Json): Promise<FakeCustomer> => {
      const customer: FakeCustomer = {
        id: fakeId("cus"),
        object: "customer",
        email: typeof params.email === "string" ? params.email : null,
        phone: typeof params.phone === "string" ? params.phone : null,
        name: typeof params.name === "string" ? params.name : null,
        metadata: (params.metadata as Json | undefined) ?? {},
        livemode: false,
      };
      fakeStripeStore.customers.set(customer.id, customer);
      return customer;
    },
    retrieve: async (id: string, _opts?: Json) => {
      const customer = fakeStripeStore.customers.get(id);
      if (!customer || customer.deleted) {
        return { id, object: "customer", deleted: true, livemode: false };
      }
      return customer;
    },
    del: async (id: string, _opts?: Json) => {
      const customer = fakeStripeStore.customers.get(id);
      if (customer) customer.deleted = true;
      return { id, object: "customer", deleted: true, livemode: false };
    },
  };

  readonly refunds = {
    create: async (params: Json = {}, _opts?: Json) => {
      const refund = {
        id: fakeId("re"),
        object: "refund",
        status: "succeeded",
        amount: Number(params.amount ?? 0),
        currency: "jpy",
        payment_intent: typeof params.payment_intent === "string" ? params.payment_intent : null,
        charge: typeof params.charge === "string" ? params.charge : null,
        metadata: (params.metadata as Json | undefined) ?? {},
        livemode: false,
      };
      fakeStripeStore.refunds.set(refund.id, refund);
      return refund;
    },
    retrieve: async (id: string, _opts?: Json) => {
      const refund = fakeStripeStore.refunds.get(id);
      if (!refund) {
        throw new FakeStripeError("resource_missing", `No such refund: ${id}`);
      }
      return refund;
    },
  };

  readonly balanceTransactions = {
    list: async (_params?: Json, _opts?: Json) => ({ object: "list", data: [], has_more: false }),
  };

  readonly webhooks = {
    /**
     * Faithful mirror of Stripe's `t,v1` HMAC-SHA256 scheme so the webhook
     * entrance's signature verification is exercised for real locally.
     */
    constructEvent: (payload: string | Buffer, header: string, secret: string, toleranceSeconds = 300) => {
      const entries = header.split(",").map((part) => part.split("="));
      const timestamp = entries.find(([k]) => k === "t")?.[1];
      const signatures = entries.filter(([k]) => k === "v1").map(([, v]) => v);
      if (!timestamp || signatures.length === 0) {
        throw new Error("fake_stripe_signature_missing");
      }
      const ts = Number(timestamp);
      if (!Number.isSafeInteger(ts) || Math.abs(nowSeconds() - ts) > toleranceSeconds) {
        throw new Error("fake_stripe_signature_timestamp_out_of_tolerance");
      }
      const expected = createHmac("sha256", secret)
        .update(`${timestamp}.${typeof payload === "string" ? payload : payload.toString("utf8")}`, "utf8")
        .digest("hex");
      if (!signatures.some((sig) => sig === expected)) {
        throw new Error("fake_stripe_signature_mismatch");
      }
      return JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8")) as Json;
    },
  };
}

/** Builds a correctly-signed fake `stripe-signature` header for local tests. */
export function signFakeStripePayload(payload: string, secret: string, timestamp = nowSeconds()): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
