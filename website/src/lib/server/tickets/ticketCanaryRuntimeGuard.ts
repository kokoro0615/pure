import "server-only";

const PRODUCTION_ORIGINS = new Set([
  "https://buy.club-pure.com",
  "https://www.club-pure.com",
  "https://club-pure.com",
  "https://pure-website.vercel.app",
  "https://pure-vip-ops.vercel.app",
]);
const PRODUCTION_SUPABASE_PROJECT_REF = "pure-local-project";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
export type TicketCanaryRuntimeAuthority = Readonly<{
  enabled: true;
  runId: string;
  publicOrigin: string;
  supabaseProjectRef: string;
  stripeMode: "test";
  recipientIdentityHashes: readonly string[];
  ownerApprovedUntil?: string;
}> | Readonly<{ enabled: false }>;

export function readTicketCanaryRuntimeAuthority(
  environment: RuntimeEnvironment = process.env,
): TicketCanaryRuntimeAuthority {
  const runId = environment.PURE_TICKET_CANARY_RUN_ID?.trim() ?? "";
  if (!runId) return Object.freeze({ enabled: false });
  const publicOrigin = canonicalOrigin(
    environment.TICKET_WALLET_PUBLIC_ORIGIN
      ?? (environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : undefined),
  );
  const supabaseProjectRef = environment.PURE_TICKET_CANARY_SUPABASE_PROJECT_REF?.trim() ?? "";
  const supabaseUrl = canonicalOrigin(environment.SUPABASE_URL);
  const stripeKey = environment.STRIPE_SECRET_KEY?.trim() ?? "";
  const recipientIdentityHashes = (environment.PURE_TICKET_CANARY_RECIPIENT_HASHES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const ownerApprovedUntil = environment.PURE_TICKET_CANARY_OWNER_APPROVED_UNTIL;
  if (
    (ownerApprovedUntil !== undefined && (!Number.isFinite(Date.parse(ownerApprovedUntil))
      || new Date(ownerApprovedUntil).toISOString() !== ownerApprovedUntil))
    || !UUID_PATTERN.test(runId)
    || environment.TICKET_WALLET_ENVIRONMENT !== "test"
    || publicOrigin === null
    || PRODUCTION_ORIGINS.has(publicOrigin)
    || (!publicOrigin.endsWith(".vercel.app") && !(environment.VERCEL_ENV === "preview"
      && environment.PURE_TICKET_CANARY_OWNED_ORIGIN === publicOrigin
      && typeof environment.TICKET_PASSKEY_OWNED_ROOT_DOMAIN === "string"
      && new URL(publicOrigin).hostname.endsWith(`.${environment.TICKET_PASSKEY_OWNED_ROOT_DOMAIN}`)))
    || !/^[a-z]{20}$/u.test(supabaseProjectRef)
    || supabaseProjectRef === PRODUCTION_SUPABASE_PROJECT_REF
    || supabaseUrl !== `https://${supabaseProjectRef}.supabase.co`
    || !/^(?:rk|sk)_test_/u.test(stripeKey)
    || /^(?:rk|sk)_live_/u.test(stripeKey)
    || recipientIdentityHashes.length < 1
    || recipientIdentityHashes.length > 20
    || new Set(recipientIdentityHashes).size !== recipientIdentityHashes.length
    || recipientIdentityHashes.some((value) => !HASH_PATTERN.test(value))
  ) {
    throw new Error("ticket_canary_runtime_authority_invalid");
  }
  return Object.freeze({
    enabled: true,
    runId,
    publicOrigin,
    supabaseProjectRef,
    stripeMode: "test",
    recipientIdentityHashes: Object.freeze([...recipientIdentityHashes]),
    ...(ownerApprovedUntil !== undefined ? { ownerApprovedUntil } : {}),
  });
}

export function assertTicketCanaryRuntimeAuthority(
  environment: RuntimeEnvironment = process.env,
) {
  return readTicketCanaryRuntimeAuthority(environment);
}

export function assertTicketCanaryOutboundUrl(
  value: string | URL,
  environment: RuntimeEnvironment = process.env,
) {
  const authority = readTicketCanaryRuntimeAuthority(environment);
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value) : new URL(value);
  } catch {
    throw new Error("ticket_canary_outbound_url_invalid");
  }
  if (authority.enabled && PRODUCTION_ORIGINS.has(url.origin)) {
    throw new Error("ticket_canary_production_authority_rejected");
  }
  return url;
}

export function assertTicketCanaryRecipientAllowed(
  recipientIdentityHash: string,
  environment: RuntimeEnvironment = process.env,
) {
  const authority = readTicketCanaryRuntimeAuthority(environment);
  if (!HASH_PATTERN.test(recipientIdentityHash)) {
    throw new Error("ticket_canary_recipient_hash_invalid");
  }
  if (
    authority.enabled
    && !authority.recipientIdentityHashes.includes(recipientIdentityHash)
  ) {
    throw new Error("ticket_canary_recipient_not_allowlisted");
  }
  return recipientIdentityHash;
}

function canonicalOrigin(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.port
      && url.pathname === "/"
      && !url.search
      && !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
