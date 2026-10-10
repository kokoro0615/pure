import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const ATTESTATION_CONTEXT = "ghost.resend.activation-attestation.v1\0";
const MAX_ATTESTATION_BYTES = 2_048;
const MAX_ATTESTATION_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/u;

type ResendActivationAttestation = Readonly<{
  version: 1;
  provider: "resend";
  domain: string;
  verifiedAt: string;
  verificationMethod: "owner_dashboard_dns_canary";
  canaryProviderIdHash: string;
}>;

export function verifyResendActivationAttestation(input: Readonly<{
  serializedAttestation: string | undefined;
  signatureSha256: string | undefined;
  webhookSecret: string | undefined;
  provider: string | null;
  from: string | undefined;
  now?: number;
  /**
   * Seven-day freshness. On by default; purchase readiness turns it off
   * (Owner decision 2026-09-17: mail health never stops sales) and keeps only
   * the signature and provider binding. Monitoring still reports the age.
   */
  enforceAge?: boolean;
}>) {
  const now = input.now ?? Date.now();
  if (
    typeof input.serializedAttestation !== "string"
    || Buffer.byteLength(input.serializedAttestation, "utf8") > MAX_ATTESTATION_BYTES
    || !SIGNATURE_PATTERN.test(input.signatureSha256 ?? "")
    || typeof input.webhookSecret !== "string"
    || Buffer.byteLength(input.webhookSecret, "utf8") < 16
    || input.provider !== "resend"
    || !Number.isFinite(now)
  ) {
    return false;
  }

  const attestation = parseAttestation(input.serializedAttestation);
  const fromDomain = readMailboxDomain(input.from);
  if (!attestation || !fromDomain || attestation.domain !== fromDomain) return false;

  const verifiedAt = Date.parse(attestation.verifiedAt);
  if (
    !Number.isFinite(verifiedAt)
    || new Date(verifiedAt).toISOString() !== attestation.verifiedAt
    || verifiedAt > now + MAX_FUTURE_SKEW_MS
    || (input.enforceAge !== false && now - verifiedAt > MAX_ATTESTATION_AGE_MS)
  ) {
    return false;
  }

  const expected = createHmac("sha256", input.webhookSecret)
    .update(ATTESTATION_CONTEXT, "utf8")
    .update(serializeAttestation(attestation), "utf8")
    .digest();
  const received = Buffer.from(input.signatureSha256 ?? "", "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseAttestation(serialized: string): ResendActivationAttestation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
  if (
    !isRecord(parsed)
    || Object.keys(parsed).length !== 6
    || parsed.version !== 1
    || parsed.provider !== "resend"
    || typeof parsed.domain !== "string"
    || parsed.domain !== parsed.domain.toLowerCase()
    || !DOMAIN_PATTERN.test(parsed.domain)
    || typeof parsed.verifiedAt !== "string"
    || parsed.verificationMethod !== "owner_dashboard_dns_canary"
    || typeof parsed.canaryProviderIdHash !== "string"
    || !SHA256_PATTERN.test(parsed.canaryProviderIdHash)
  ) {
    return null;
  }
  return parsed as ResendActivationAttestation;
}

function serializeAttestation(attestation: ResendActivationAttestation) {
  return JSON.stringify({
    version: attestation.version,
    provider: attestation.provider,
    domain: attestation.domain,
    verifiedAt: attestation.verifiedAt,
    verificationMethod: attestation.verificationMethod,
    canaryProviderIdHash: attestation.canaryProviderIdHash,
  });
}

function readMailboxDomain(value: string | undefined) {
  if (typeof value !== "string" || value.length > 320) return null;
  const trimmed = value.trim();
  const address = trimmed.includes("<") && trimmed.endsWith(">")
    ? trimmed.slice(trimmed.lastIndexOf("<") + 1, -1)
    : trimmed;
  const match = address.match(/^[^\s<>@]+@([^\s<>@]+)$/u);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
