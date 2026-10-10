import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
const MINIMUM_KEY_BYTES = 32;
const MAXIMUM_KEY_BYTES = 64;
const MAXIMUM_KEYRING_BYTES = 8_192;
const MAXIMUM_KEYS = 16;
const MAXIMUM_AUTH_VALUE_BYTES = 8_192;
const OTP_ENVELOPE_VERSION = 1 as const;
const OTP_NONCE_BYTES = 12;
const OTP_AUTH_TAG_BYTES = 16;
const MAXIMUM_OTP_ENVELOPE_BYTES = 2_048;
const MAXIMUM_CHALLENGE_BINDING_BYTES = 512;

export type TicketAuthPurpose =
  | "otp-encryption"
  | "otp-verifier"
  | "pre-auth-token"
  | "pre-auth-csrf"
  | "wallet-session-token"
  | "wallet-session-csrf"
  | "admission-challenge"
  | "admission-prepare-idempotency"
  | "admission-commit-idempotency"
  | "admission-request"
  | "abuse-email"
  | "abuse-ip"
  | "abuse-user-agent";

type TicketAuthKeyringShape = {
  activeKeyId: string;
  keys: Map<string, Buffer>;
};

export class TicketAuthCryptoError extends Error {
  readonly code:
    | "TICKET_AUTH_CRYPTO_NOT_CONFIGURED"
    | "TICKET_AUTH_CRYPTO_INVALID_CONFIG"
    | "TICKET_AUTH_ENVELOPE_INVALID"
    | "TICKET_AUTH_KEY_UNKNOWN"
    | "TICKET_AUTH_DECRYPT_FAILED";

  constructor(code: TicketAuthCryptoError["code"]) {
    super(code);
    this.name = "TicketAuthCryptoError";
    this.code = code;
  }
}

export class TicketAuthKeyring {
  readonly activeKeyId: string;
  readonly keyIds: readonly string[];
  readonly #keys: ReadonlyMap<string, Buffer>;

  constructor(shape: TicketAuthKeyringShape) {
    this.activeKeyId = shape.activeKeyId;
    this.keyIds = Object.freeze([...shape.keys.keys()].sort());
    this.#keys = shape.keys;
  }

  keyFor(keyId: string) {
    const key = this.#keys.get(keyId);
    return key ? Buffer.from(key) : null;
  }
}

export function readTicketAuthKeyring(
  environment: Readonly<{ TICKET_AUTH_KEYRING?: string }> = process.env as Readonly<{
    TICKET_AUTH_KEYRING?: string;
  }>,
) {
  const serialized = environment.TICKET_AUTH_KEYRING;
  if (typeof serialized !== "string" || serialized.length === 0) {
    throw new TicketAuthCryptoError("TICKET_AUTH_CRYPTO_NOT_CONFIGURED");
  }
  return parseTicketAuthKeyring(serialized);
}

export function parseTicketAuthKeyring(serialized: string) {
  if (
    typeof serialized !== "string"
    || serialized.length === 0
    || Buffer.byteLength(serialized, "utf8") > MAXIMUM_KEYRING_BYTES
  ) {
    throw invalidConfiguration();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw invalidConfiguration();
  }

  if (
    !isRecord(parsed)
    || Object.keys(parsed).length !== 2
    || !Object.hasOwn(parsed, "activeKeyId")
    || !Object.hasOwn(parsed, "keys")
    || typeof parsed.activeKeyId !== "string"
    || !KEY_ID_PATTERN.test(parsed.activeKeyId)
    || !isRecord(parsed.keys)
  ) {
    throw invalidConfiguration();
  }

  const configuredKeys = Object.entries(parsed.keys);
  if (configuredKeys.length === 0 || configuredKeys.length > MAXIMUM_KEYS) {
    throw invalidConfiguration();
  }

  const keys = new Map<string, Buffer>();
  for (const [keyId, material] of configuredKeys) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof material !== "string") {
      throw invalidConfiguration();
    }
    keys.set(keyId, decodeKeyMaterial(material));
  }

  if (!keys.has(parsed.activeKeyId)) {
    throw invalidConfiguration();
  }

  return new TicketAuthKeyring({ activeKeyId: parsed.activeKeyId, keys });
}

export function generateTicketOtp(
  randomInteger: (minimum: number, maximum: number) => number = randomInt,
) {
  const value = randomInteger(0, 1_000_000);
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1_000_000) {
    throw new TicketAuthCryptoError("TICKET_AUTH_CRYPTO_INVALID_CONFIG");
  }
  return value.toString().padStart(6, "0");
}

export function createTicketAuthDigest(
  keyring: TicketAuthKeyring,
  purpose: TicketAuthPurpose,
  value: string,
  keyId = keyring.activeKeyId,
) {
  if (!isBoundedString(value, MAXIMUM_AUTH_VALUE_BYTES)) {
    throw invalidConfiguration();
  }
  const key = requireKey(keyring, keyId);
  const digest = createHmac("sha256", derivePurposeKey(key, purpose))
    .update("ghost.ticket-auth.digest.v1\0", "utf8")
    .update(keyId, "utf8")
    .update("\0", "utf8")
    .update(value, "utf8")
    .digest("base64url");
  return `v1:${keyId}:${digest}`;
}

export function verifyTicketAuthDigest(
  keyring: TicketAuthKeyring,
  purpose: TicketAuthPurpose,
  value: string,
  encodedDigest: string,
) {
  if (!isBoundedString(value, MAXIMUM_AUTH_VALUE_BYTES) || typeof encodedDigest !== "string") {
    return false;
  }
  const match = encodedDigest.match(/^v1:([A-Za-z0-9._-]{1,64}):([A-Za-z0-9_-]{43})$/u);
  if (!match) return false;
  const [, keyId, receivedDigest] = match;
  if (!keyring.keyFor(keyId)) return false;

  const expected = Buffer.from(createTicketAuthDigest(keyring, purpose, value, keyId).split(":")[2], "base64url");
  const received = Buffer.from(receivedDigest, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function encryptTicketOtp(
  keyring: TicketAuthKeyring,
  otp: string,
  challengeBinding: string,
  nonceSource: (size: number) => Buffer = randomBytes,
) {
  if (!/^\d{6}$/u.test(otp) || !isBoundedString(challengeBinding, MAXIMUM_CHALLENGE_BINDING_BYTES)) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  const keyId = keyring.activeKeyId;
  const nonce = nonceSource(OTP_NONCE_BYTES);
  if (!Buffer.isBuffer(nonce) || nonce.length !== OTP_NONCE_BYTES) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  const key = derivePurposeKey(requireKey(keyring, keyId), "otp-encryption");
  const cipher = createCipheriv("aes-256-gcm", key, nonce, {
    authTagLength: OTP_AUTH_TAG_BYTES,
  });
  cipher.setAAD(otpEnvelopeAad(keyId, challengeBinding));
  const ciphertext = Buffer.concat([cipher.update(otp, "utf8"), cipher.final()]);
  return Buffer.from(JSON.stringify({
    formatVersion: OTP_ENVELOPE_VERSION,
    keyId,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  }), "utf8");
}

export function decryptTicketOtp(
  keyring: TicketAuthKeyring,
  packedEnvelope: Buffer | Uint8Array | string,
  challengeBinding: string,
) {
  if (!isBoundedString(challengeBinding, MAXIMUM_CHALLENGE_BINDING_BYTES)) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  const envelope = parseOtpEnvelope(packedEnvelope);
  const masterKey = keyring.keyFor(envelope.keyId);
  if (!masterKey) {
    throw new TicketAuthCryptoError("TICKET_AUTH_KEY_UNKNOWN");
  }

  try {
    const nonce = decodeCanonicalBase64(envelope.nonce, OTP_NONCE_BYTES);
    const ciphertext = decodeCanonicalBase64(envelope.ciphertext);
    const authTag = decodeCanonicalBase64(envelope.authTag, OTP_AUTH_TAG_BYTES);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      derivePurposeKey(masterKey, "otp-encryption"),
      nonce,
      { authTagLength: OTP_AUTH_TAG_BYTES },
    );
    decipher.setAAD(otpEnvelopeAad(envelope.keyId, challengeBinding));
    decipher.setAuthTag(authTag);
    const otp = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    if (!/^\d{6}$/u.test(otp)) throw new Error("invalid otp");
    return otp;
  } catch {
    throw new TicketAuthCryptoError("TICKET_AUTH_DECRYPT_FAILED");
  }
}

function decodeKeyMaterial(material: string) {
  let decoded: Buffer;
  if (material.startsWith("hex:")) {
    const hex = material.slice(4);
    if (!/^[0-9a-f]+$/iu.test(hex) || hex.length % 2 !== 0) {
      throw invalidConfiguration();
    }
    decoded = Buffer.from(hex, "hex");
  } else {
    const base64 = material.startsWith("base64:") ? material.slice(7) : material;
    if (!isCanonicalBase64(base64)) {
      throw invalidConfiguration();
    }
    decoded = Buffer.from(base64, "base64");
  }

  if (decoded.length < MINIMUM_KEY_BYTES || decoded.length > MAXIMUM_KEY_BYTES) {
    throw invalidConfiguration();
  }
  return decoded;
}

function parseOtpEnvelope(packedEnvelope: Buffer | Uint8Array | string) {
  const packed = typeof packedEnvelope === "string"
    ? Buffer.from(packedEnvelope, "utf8")
    : Buffer.from(packedEnvelope);
  if (packed.length === 0 || packed.length > MAXIMUM_OTP_ENVELOPE_BYTES) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(packed.toString("utf8")) as unknown;
  } catch {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  if (
    !isRecord(parsed)
    || Object.keys(parsed).length !== 5
    || parsed.formatVersion !== OTP_ENVELOPE_VERSION
    || typeof parsed.keyId !== "string"
    || !KEY_ID_PATTERN.test(parsed.keyId)
    || typeof parsed.nonce !== "string"
    || typeof parsed.ciphertext !== "string"
    || typeof parsed.authTag !== "string"
  ) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  decodeCanonicalBase64(parsed.nonce, OTP_NONCE_BYTES);
  decodeCanonicalBase64(parsed.ciphertext);
  decodeCanonicalBase64(parsed.authTag, OTP_AUTH_TAG_BYTES);
  return parsed as {
    formatVersion: typeof OTP_ENVELOPE_VERSION;
    keyId: string;
    nonce: string;
    ciphertext: string;
    authTag: string;
  };
}

function decodeCanonicalBase64(value: string, expectedBytes?: number) {
  if (!isCanonicalBase64(value)) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  const decoded = Buffer.from(value, "base64");
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) {
    throw new TicketAuthCryptoError("TICKET_AUTH_ENVELOPE_INVALID");
  }
  return decoded;
}

function derivePurposeKey(key: Buffer, purpose: TicketAuthPurpose) {
  return createHmac("sha256", key)
    .update("ghost.ticket-auth.kdf.v1\0", "utf8")
    .update(purpose, "utf8")
    .digest();
}

function requireKey(keyring: TicketAuthKeyring, keyId: string) {
  const key = keyring.keyFor(keyId);
  if (!key) throw invalidConfiguration();
  return key;
}

function otpEnvelopeAad(keyId: string, challengeBinding: string) {
  return Buffer.from(
    `ghost.ticket-auth.otp-envelope.v${OTP_ENVELOPE_VERSION}\0${keyId}\0${challengeBinding}`,
    "utf8",
  );
}

function isBoundedString(value: unknown, maximumBytes: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= maximumBytes;
}

function isCanonicalBase64(value: string) {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
    && Buffer.from(value, "base64").toString("base64") === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidConfiguration() {
  return new TicketAuthCryptoError("TICKET_AUTH_CRYPTO_INVALID_CONFIG");
}
