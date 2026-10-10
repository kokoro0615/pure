import "server-only";

import { createHash } from "node:crypto";

import { parseTicketAuthKeyring } from "./ticketAuthCrypto";

type SecretEnvironment = Readonly<Record<string, string | undefined>> & Readonly<{
  TICKET_AUTH_KEYRING?: string;
  TICKET_LINK_SECRET?: string;
  VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY?: string;
}>;

export function ticketWalletSecretsAreIndependent(environment: SecretEnvironment) {
  try {
    const auth = authKeyFingerprints(environment.TICKET_AUTH_KEYRING);
    const link = linkKeyFingerprints(environment.TICKET_LINK_SECRET);
    const profile = profileKeyFingerprints(environment.VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY);
    if (auth.size === 0 || link.size === 0 || profile.size === 0) return false;
    return !overlaps(auth, link) && !overlaps(auth, profile) && !overlaps(link, profile);
  } catch {
    return false;
  }
}

function authKeyFingerprints(serialized: string | undefined) {
  if (!serialized) return new Set<string>();
  const keyring = parseTicketAuthKeyring(serialized);
  return new Set(keyring.keyIds.flatMap((keyId) => {
    const key = keyring.keyFor(keyId);
    return key ? [fingerprint(key)] : [];
  }));
}

function linkKeyFingerprints(serialized: string | undefined) {
  if (typeof serialized !== "string" || serialized.length < 32) return new Set<string>();
  const fingerprints = new Set([fingerprint(Buffer.from(serialized, "utf8"))]);
  const decoded = decodeRecognizedMaterial(serialized, 32, 64);
  if (decoded) fingerprints.add(fingerprint(decoded));
  return fingerprints;
}

function profileKeyFingerprints(serialized: string | undefined) {
  if (!serialized) return new Set<string>();
  const materials: string[] = [];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    // The established customer-profile format also accepts one key entry.
  }
  if (isRecord(parsed) && isRecord(parsed.keys)) {
    for (const material of Object.values(parsed.keys)) {
      if (typeof material !== "string") return new Set<string>();
      materials.push(material);
    }
  } else {
    const separator = serialized.indexOf(":");
    materials.push(
      separator > 0 && !serialized.startsWith("base64:") && !serialized.startsWith("hex:")
        ? serialized.slice(separator + 1)
        : serialized,
    );
  }
  return new Set(materials.map((material) => {
    const decoded = decodeRecognizedMaterial(material, 32, 32);
    if (!decoded) throw new Error("profile_key_invalid");
    return fingerprint(decoded);
  }));
}

function decodeRecognizedMaterial(value: string, minimumBytes: number, maximumBytes: number) {
  let decoded: Buffer | null = null;
  if (value.startsWith("hex:")) {
    const hex = value.slice(4);
    if (/^[a-f0-9]+$/iu.test(hex) && hex.length % 2 === 0) decoded = Buffer.from(hex, "hex");
  } else {
    const base64 = value.startsWith("base64:") ? value.slice(7) : value;
    if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(base64)) {
      const candidate = Buffer.from(base64, "base64");
      if (candidate.toString("base64") === base64) decoded = candidate;
    }
  }
  if (!decoded || decoded.length < minimumBytes || decoded.length > maximumBytes) return null;
  return decoded;
}

function fingerprint(material: Buffer) {
  return createHash("sha256")
    .update("ghost.ticket-wallet.secret-independence.v1\0", "utf8")
    .update(material)
    .digest("base64url");
}

function overlaps(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
