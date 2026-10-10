import { createHash } from "node:crypto";

const FEATURE_FLAG_NAMES = [
  "FEATURE_PUBLIC_BOOKING_ENABLED",
  "FEATURE_ADMIN_MUTATION_ENABLED",
  "FEATURE_WEBHOOK_PROCESSING_ENABLED",
  "FEATURE_LINE_NOTIFICATIONS_ENABLED",
  "FEATURE_TICKET_DAILY_LINE_REPORT_ENABLED",
  "FEATURE_EMAIL_NOTIFICATIONS_ENABLED",
  "FEATURE_VIP_FLOOR_V2_READ_ENABLED",
  "FEATURE_VIP_FLOOR_V2_MUTATION_ENABLED",
  "FEATURE_VIP_FLOOR_DUAL_WRITE_ENABLED",
  "FEATURE_VIP_FLOOR_V2_SHADOW_COMPARE_ENABLED",
  "FEATURE_VIP_CUSTOMER_PROFILE_WRITE_ENABLED",
  "FEATURE_TICKET_SALES_ENABLED",
  "FEATURE_TICKET_WALLET_READ_ENABLED",
  "FEATURE_TICKET_OTP_DELIVERY_ENABLED",
  "FEATURE_TICKET_SWIPE_PREPARE_ENABLED",
  "FEATURE_TICKET_SWIPE_COMMIT_ENABLED",
  "FEATURE_TICKET_MANAGER_OPERATIONS_ENABLED",
  "FEATURE_TICKET_REFUND_REVIEW_ENABLED",
  "FEATURE_EMAIL_PROVIDER_WEBHOOK_ENABLED",
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

export function isFeatureEnabled(name: FeatureFlagName) {
  return parseFeatureFlag(process.env[name]);
}

export function getFeatureFlagSnapshot() {
  return Object.fromEntries(
    FEATURE_FLAG_NAMES.map((name) => [
      name,
      {
        enabled: isFeatureEnabled(name),
        configured: process.env[name] !== undefined,
        rawState: describeRawFlag(process.env[name]),
      },
    ]),
  ) as Record<
    FeatureFlagName,
    {
      enabled: boolean;
      configured: boolean;
      rawState: "missing" | "enabled" | "disabled" | "invalid";
    }
  >;
}

export function getRuntimeReadbackSnapshot() {
  const publicBookingReadiness = getPublicBookingEnvPresence();

  return {
    generatedAt: new Date().toISOString(),
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelTargetEnv: process.env.VERCEL_TARGET_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      runtimeSourceSha256: readRuntimeSourceSha256(),
      oidcIssuerIdentitySha256: readOidcIssuerIdentitySha256(),
    },
    featureFlags: getFeatureFlagSnapshot(),
    envPresence: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
      TURNSTILE_SITE_KEY: Boolean(process.env.TURNSTILE_SITE_KEY),
      TURNSTILE_SECRET_KEY: Boolean(process.env.TURNSTILE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      PURE_WORKER_RUN_SECRET: Boolean(process.env.PURE_WORKER_RUN_SECRET),
      RESERVATION_HASH_SALT: Boolean(process.env.RESERVATION_HASH_SALT),
      LINE_CHANNEL_ACCESS_TOKEN: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      LINE_GROUP_ID: Boolean(process.env.LINE_GROUP_ID),
      PURE_EMAIL_DELIVERY_ENDPOINT: Boolean(process.env.PURE_EMAIL_DELIVERY_ENDPOINT),
      TICKET_LINK_SECRET: Boolean(process.env.TICKET_LINK_SECRET),
      PURE_EMAIL_DELIVERY_TOKEN: Boolean(process.env.PURE_EMAIL_DELIVERY_TOKEN),
      PURE_EMAIL_FROM: Boolean(process.env.PURE_EMAIL_FROM),
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER === "resend" ? "resend" : null,
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      RESEND_WEBHOOK_SECRET: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      RESEND_FROM: Boolean(process.env.RESEND_FROM),
      RESEND_ACTIVATION_ATTESTATION_SHA256: isSha256(
        process.env.RESEND_ACTIVATION_ATTESTATION_SHA256,
      ),
      TICKET_AUTH_KEYRING: Boolean(process.env.TICKET_AUTH_KEYRING),
      TICKET_WALLET_PUBLIC_ORIGIN: isHttpsOrigin(process.env.TICKET_WALLET_PUBLIC_ORIGIN),
      PURE_BOOKING_PUBLIC_ORIGIN: isHttpsOrigin(process.env.PURE_BOOKING_PUBLIC_ORIGIN),
      TICKET_WALLET_DB_CONTRACT: process.env.TICKET_WALLET_DB_CONTRACT ?? null,
      VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY: Boolean(
        process.env.VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY,
      ),
      VIP_CUSTOMER_PROFILE_ENCRYPTION_LEGACY_KEYS: Boolean(
        process.env.VIP_CUSTOMER_PROFILE_ENCRYPTION_LEGACY_KEYS,
      ),
      VIP_CUSTOMER_SEARCH_KEY: Boolean(process.env.VIP_CUSTOMER_SEARCH_KEY),
      VIP_FLOOR_SHADOW_COMPARE_KEY: Boolean(process.env.VIP_FLOOR_SHADOW_COMPARE_KEY),
    },
    publicBookingReadiness,
  };
}

function isSha256(value: string | undefined) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isHttpsOrigin(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.origin !== value.replace(/\/$/u, "")) return false;
    if (url.protocol === "https:") return true;
    // Outside production a loopback http origin is a valid local booking surface.
    if (url.protocol === "http:" && process.env.PURE_PROFILE !== "production") {
      return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    }
    return false;
  } catch {
    return false;
  }
}

function readOidcIssuerIdentitySha256() {
  const value = process.env.VIP_FLOOR_VERCEL_OIDC_ISSUER;
  if (typeof value !== "string" || value.length === 0) return null;
  return createHash("sha256").update(value).digest("hex");
}

function readRuntimeSourceSha256() {
  const value = process.env.VIP_FLOOR_RUNTIME_SOURCE_SHA256;
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function parseFeatureFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function describeRawFlag(value: string | undefined) {
  if (value === undefined) {
    return "missing";
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return "enabled";
  }

  if (["0", "false", "no", "off", ""].includes(normalized)) {
    return "disabled";
  }

  return "invalid";
}

function getPublicBookingEnvPresence() {
  const missing = [
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "PURE_WORKER_RUN_SECRET",
    "RESERVATION_HASH_SALT",
    "PURE_BOOKING_PUBLIC_ORIGIN",
  ].filter((name) => !process.env[name]);
  const invalid = [
    ...(!isFeatureEnabled("FEATURE_WEBHOOK_PROCESSING_ENABLED")
      ? ["FEATURE_WEBHOOK_PROCESSING_ENABLED"]
      : []),
    ...(process.env.PURE_BOOKING_PUBLIC_ORIGIN
      && !isHttpsOrigin(process.env.PURE_BOOKING_PUBLIC_ORIGIN)
      ? ["PURE_BOOKING_PUBLIC_ORIGIN"]
      : []),
  ];

  return {
    requiredWhenPublicBookingEnabled: true,
    ok: !isFeatureEnabled("FEATURE_PUBLIC_BOOKING_ENABLED") || (missing.length === 0 && invalid.length === 0),
    missing,
    invalid,
  };
}
