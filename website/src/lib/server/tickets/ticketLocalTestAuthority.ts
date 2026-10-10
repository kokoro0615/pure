import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { readRuntimeEnvironment } from '../runtimeEnvironment';
import {
  TICKETS_REVISION_DB_HEAD,
  TICKETS_REVISION_DB_BUNDLE_SHA256,
  ticketRevisionSourceCommit,
} from './ticketRevisionReadiness';

/*
 * Bounded LOCAL-ONLY test authority for the ticket-wallet revision gate.
 *
 * The production release manifest (ticketRevisionReadiness) requires genuinely
 * passed paired-canary/provider/venue evidence, and the cloud canary authority
 * requires a real hosted Supabase project plus a deployed preview origin. Both
 * are intentionally impossible to satisfy on an isolated local process — that
 * isolation is the production safety property, and this module does not weaken
 * either contract. Instead it is a THIRD, unambiguous authority kind:
 *
 *   - kind 'ghost.tickets.localtest.grant', mode 'local_test', separately
 *     signed with an ephemeral operator-held key (never the release or canary
 *     signing material, never re-signed production evidence);
 *   - structurally incapable of activating on a deployed runtime: any VERCEL_*
 *     marker, a live Stripe key, a production origin, a non-literal-loopback
 *     database URL, or any binding mutation fails closed;
 *   - it authorizes ONLY the phase-A revision-evidence gate
 *     (walletCheckout readiness). Every other readiness input — secret
 *     independence, auth keyring, provider attestation, feature flags,
 *     owner authority — is still required unchanged;
 *   - it is NOT evidence: it records no passed checks and must never be
 *     presented as release/canary/provider/venue proof.
 */

export const TICKET_LOCAL_TEST_GRANT_KIND = 'ghost.tickets.localtest.grant';
export const TICKET_LOCAL_TEST_MODE = 'local_test';
export const TICKET_LOCAL_TEST_STRIPE_ACCOUNT = 'acct_1TN1c13y1kbF9W7B';
// The local test origin is an RFC 2606 reserved name bound to a nonstandard
// port via the operator's child-scoped DNS/TLS profile. It cannot collide
// with a real deployment because production origins are refused outright.
export const TICKET_LOCAL_TEST_APP_ORIGINS = Object.freeze(['https://example.com:8443'] as const);
// Short bounded lifetime: this authority can never outlive the Owner review
// deadline for the bounded test window it was issued for.
export const TICKET_LOCAL_TEST_MAX_EXPIRY_MS = Date.parse('2026-09-16T15:50:00.000Z');
export const TICKET_LOCAL_TEST_MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;

const PRODUCTION_ORIGINS = new Set([
  'https://buy.club-pure.com',
  'https://www.club-pure.com',
  'https://club-pure.com',
  'https://pure-website.vercel.app',
  'https://pure-vip-ops.vercel.app',
]);
const PRODUCTION_SUPABASE_PROJECT_REF = 'pure-local-project';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const DEPLOYED_MARKER = /^(?:VERCEL|NOW_BUILDER|NOW_REGION|NOW_DEPLOYMENT)/u;
const SIGN_CONTEXT = 'ghost.tickets.localtest.authority.v1\0';
const GRANT_FIELDS = [
  'version', 'kind', 'mode', 'websiteCommit', 'vipCommit', 'databaseHead',
  'databaseBundleSha256', 'environment', 'appOrigin', 'restOrigins',
  'stripeAccountId', 'runId', 'recipientIdentityHashes', 'issuedAt', 'expiresAt',
] as const;

export type TicketLocalTestGrant = Readonly<{
  version: 1;
  kind: typeof TICKET_LOCAL_TEST_GRANT_KIND;
  mode: typeof TICKET_LOCAL_TEST_MODE;
  websiteCommit: string;
  vipCommit: string;
  databaseHead: string;
  databaseBundleSha256: string;
  environment: 'test';
  appOrigin: string;
  restOrigins: readonly string[];
  stripeAccountId: string;
  runId: string;
  recipientIdentityHashes: readonly string[];
  issuedAt: string;
  expiresAt: string;
}>;

export type TicketLocalTestBinding = Readonly<{
  websiteCommit: string;
  vipCommit: string;
  databaseHead: string;
  databaseBundleSha256: string;
  environment: string;
  appOrigin: string;
  supabaseUrl: string;
  stripeAccountId: string;
  runId: string;
  recipientIdentityHashes: readonly string[];
}>;

export type TicketLocalTestAuthority = Readonly<{
  enabled: true;
  runId: string;
  publicOrigin: string;
  supabaseUrl: string;
  stripeAccountId: string;
  stripeMode: 'test';
  recipientIdentityHashes: readonly string[];
}> | Readonly<{ enabled: false }>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A literal loopback http URL only — never a hostname that resolves to one. */
export function readLiteralLoopbackUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 256) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname;
  const literalLoopback = host === '127.0.0.1' || host === '[::1]';
  if (
    url.protocol !== 'http:'
    || !literalLoopback
    || url.username !== ''
    || url.password !== ''
    || url.port === ''
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search !== ''
    || url.hash !== ''
  ) {
    return null;
  }
  return url;
}

function readRecipientIdentityHashes(env: Readonly<Record<string, string | undefined>>) {
  const hashes = (env.PURE_TICKET_LOCAL_TEST_RECIPIENT_HASHES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    hashes.length < 1
    || hashes.length > 20
    || new Set(hashes).size !== hashes.length
    || hashes.some((value) => !HASH_PATTERN.test(value))
  ) {
    throw new Error('ticket_local_test_authority_invalid');
  }
  return Object.freeze([...hashes]);
}

/**
 * Runtime profile for the local-only authority. Throws on any marker of a
 * deployed or production runtime: that is the property that makes this grant
 * structurally unable to activate outside the isolated process. Enabled only
 * when the operator explicitly sets the run id.
 */
export function readTicketLocalTestAuthority(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TicketLocalTestAuthority {
  const runId = environment.PURE_TICKET_LOCAL_TEST_RUN_ID?.trim() ?? '';
  if (!runId) return Object.freeze({ enabled: false });
  const invalid = () => { throw new Error('ticket_local_test_authority_invalid'); };
  if (Object.keys(environment).some((key) => DEPLOYED_MARKER.test(key))) invalid();
  if (!UUID_PATTERN.test(runId)) invalid();
  if (environment.TICKET_WALLET_ENVIRONMENT !== 'test') invalid();
  try {
    if (readRuntimeEnvironment(environment) !== 'test') invalid();
  } catch {
    invalid();
  }
  const publicOrigin = environment.TICKET_WALLET_PUBLIC_ORIGIN?.trim() ?? '';
  if (
    !(TICKET_LOCAL_TEST_APP_ORIGINS as readonly string[]).includes(publicOrigin)
    || PRODUCTION_ORIGINS.has(publicOrigin)
  ) invalid();
  const supabaseUrl = environment.SUPABASE_URL?.trim() ?? '';
  const supabase = readLiteralLoopbackUrl(supabaseUrl);
  if (!supabase || supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) invalid();
  const stripeKey = environment.STRIPE_SECRET_KEY?.trim() ?? '';
  const stripeAccountId = environment.STRIPE_ACCOUNT_ID?.trim() ?? '';
  if (
    !/^(?:rk|sk)_test_/u.test(stripeKey)
    || /^(?:rk|sk)_live_/u.test(stripeKey)
    || stripeAccountId !== TICKET_LOCAL_TEST_STRIPE_ACCOUNT
  ) invalid();
  return Object.freeze({
    enabled: true,
    runId,
    publicOrigin,
    supabaseUrl,
    stripeAccountId,
    stripeMode: 'test',
    recipientIdentityHashes: readRecipientIdentityHashes(environment),
  });
}

export function signTicketLocalTestGrant(grant: TicketLocalTestGrant, key: string) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('local_test_key_invalid');
  if (!isGrantShape(grant)) throw new Error('local_test_grant_invalid');
  return createHmac('sha256', key).update(SIGN_CONTEXT + canonical(grant)).digest('hex');
}

function isGrantShape(grant: unknown): grant is TicketLocalTestGrant {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return false;
  const row = grant as Record<string, unknown>;
  if (Object.keys(row).length !== GRANT_FIELDS.length || !GRANT_FIELDS.every((field) => field in row)) return false;
  return row.version === 1
    && row.kind === TICKET_LOCAL_TEST_GRANT_KIND
    && row.mode === TICKET_LOCAL_TEST_MODE
    && row.environment === 'test'
    && COMMIT_PATTERN.test(row.websiteCommit as string)
    && COMMIT_PATTERN.test(row.vipCommit as string)
    && row.databaseHead === TICKETS_REVISION_DB_HEAD
    && SHA_PATTERN.test(row.databaseBundleSha256 as string)
    && row.databaseBundleSha256 === TICKETS_REVISION_DB_BUNDLE_SHA256
    && typeof row.appOrigin === 'string'
    && Array.isArray(row.restOrigins)
    && row.restOrigins.length >= 1
    && row.restOrigins.length <= 4
    && (row.restOrigins as unknown[]).every((origin) => readLiteralLoopbackUrl(origin) !== null)
    && row.stripeAccountId === TICKET_LOCAL_TEST_STRIPE_ACCOUNT
    && UUID_PATTERN.test(row.runId as string)
    && Array.isArray(row.recipientIdentityHashes)
    && (row.recipientIdentityHashes as unknown[]).length >= 1
    && (row.recipientIdentityHashes as unknown[]).length <= 20
    && new Set(row.recipientIdentityHashes as unknown[]).size === (row.recipientIdentityHashes as unknown[]).length
    && (row.recipientIdentityHashes as unknown[]).every((hash) => typeof hash === 'string' && HASH_PATTERN.test(hash))
    && typeof row.issuedAt === 'string'
    && typeof row.expiresAt === 'string';
}

export function verifyTicketLocalTestGrant(
  grant: unknown,
  signature: string,
  key: string,
  binding: TicketLocalTestBinding,
  now = Date.now(),
) {
  try {
    if (!Number.isFinite(now) || !isGrantShape(grant) || !SHA_PATTERN.test(signature ?? '') || typeof key !== 'string' || key.length < 32) {
      return false;
    }
    // Exact binding: every signed field must equal the running process's own
    // resolved identity — replay across run, source, ports, account, mode or
    // recipient set fails.
    if (
      grant.websiteCommit !== binding.websiteCommit
      || grant.vipCommit !== binding.vipCommit
      || grant.databaseHead !== binding.databaseHead
      || grant.databaseBundleSha256 !== binding.databaseBundleSha256
      || grant.environment !== binding.environment
      || grant.appOrigin !== binding.appOrigin
      || grant.runId !== binding.runId
      || grant.stripeAccountId !== binding.stripeAccountId
      || !(grant.restOrigins as readonly string[]).includes(binding.supabaseUrl)
      || canonical([...grant.recipientIdentityHashes].sort()) !== canonical([...binding.recipientIdentityHashes].sort())
    ) {
      return false;
    }
    const issued = Date.parse(grant.issuedAt);
    const expires = Date.parse(grant.expiresAt);
    if (
      !Number.isFinite(issued)
      || !Number.isFinite(expires)
      || new Date(issued).toISOString() !== grant.issuedAt
      || new Date(expires).toISOString() !== grant.expiresAt
      || issued > now
      || expires <= now
      || expires - issued > TICKET_LOCAL_TEST_MAX_LIFETIME_MS
      || expires > TICKET_LOCAL_TEST_MAX_EXPIRY_MS
    ) {
      return false;
    }
    const expected = createHmac('sha256', key).update(SIGN_CONTEXT + canonical(grant)).digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/**
 * Final authorization: the running process profile, the signed grant, and the
 * resolved env binding must all agree. Any refusal in readTicketLocalTestAuthority
 * or any binding mismatch closes the gate. This is the ONLY thing the local
 * authority can satisfy — it grants permission to exercise the real wallet
 * checkout on the isolated process; it is not release evidence.
 */
export function ticketLocalTestIsAuthorized(
  env: Readonly<Record<string, string | undefined>> = process.env,
  now = Date.now(),
) {
  try {
    const authority = readTicketLocalTestAuthority(env);
    if (!authority.enabled) return false;
    const grant = JSON.parse(env.TICKETS_LOCAL_TEST_GRANT ?? 'null');
    return verifyTicketLocalTestGrant(
      grant,
      env.TICKETS_LOCAL_TEST_SIGNATURE ?? '',
      env.TICKETS_LOCAL_TEST_EVIDENCE_SECRET ?? '',
      {
        websiteCommit: ticketRevisionSourceCommit(env),
        vipCommit: env.TICKETS_REVISION_VIP_COMMIT ?? '',
        databaseHead: env.TICKETS_REVISION_DB_HEAD ?? '',
        databaseBundleSha256: env.TICKETS_REVISION_DB_BUNDLE_SHA256 ?? '',
        environment: readRuntimeEnvironment(env),
        appOrigin: authority.publicOrigin,
        supabaseUrl: authority.supabaseUrl,
        stripeAccountId: authority.stripeAccountId,
        runId: authority.runId,
        recipientIdentityHashes: authority.recipientIdentityHashes,
      },
      now,
    );
  } catch {
    return false;
  }
}

/** Recipient allowlist, parallel to the cloud canary guard. */
export function assertTicketLocalTestRecipientAllowed(
  recipientIdentityHash: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const authority = readTicketLocalTestAuthority(environment);
  if (!HASH_PATTERN.test(recipientIdentityHash)) {
    throw new Error('ticket_local_test_recipient_hash_invalid');
  }
  if (authority.enabled && !authority.recipientIdentityHashes.includes(recipientIdentityHash)) {
    throw new Error('ticket_local_test_recipient_not_allowlisted');
  }
  return recipientIdentityHash;
}
