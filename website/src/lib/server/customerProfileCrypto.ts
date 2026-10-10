import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ENVELOPE_FORMAT_VERSION = 1 as const;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_PACKED_ENVELOPE_BYTES = 1_000_000;
const ACTIVE_ENCRYPTION_KEY_ENV = "VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY";
const LEGACY_ENCRYPTION_KEYS_ENV = "VIP_CUSTOMER_PROFILE_ENCRYPTION_LEGACY_KEYS";
const SEARCH_KEY_ENV = "VIP_CUSTOMER_SEARCH_KEY";
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type CustomerProfileEnvelope = {
  formatVersion: typeof ENVELOPE_FORMAT_VERSION;
  keyId: string;
  nonce: string;
  ciphertext: string;
  authTag: string;
};

type KeyEntry = {
  keyId: string;
  key: Buffer;
};

export class CustomerProfileCryptoError extends Error {
  readonly code:
    | "CUSTOMER_PROFILE_CRYPTO_NOT_CONFIGURED"
    | "CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG"
    | "CUSTOMER_PROFILE_ENVELOPE_INVALID"
    | "CUSTOMER_PROFILE_KEY_UNKNOWN"
    | "CUSTOMER_PROFILE_DECRYPT_FAILED";

  constructor(code: CustomerProfileCryptoError["code"]) {
    super(code);
    this.name = "CustomerProfileCryptoError";
    this.code = code;
  }
}

export function getCustomerProfileCryptoConfiguration() {
  return {
    encryptionKeyConfigured: Boolean(process.env[ACTIVE_ENCRYPTION_KEY_ENV]),
    legacyEncryptionKeysConfigured: Boolean(process.env[LEGACY_ENCRYPTION_KEYS_ENV]),
    searchKeyConfigured: Boolean(process.env[SEARCH_KEY_ENV]),
  };
}

export function encryptCustomerProfileValue(plaintext: string) {
  if (typeof plaintext !== "string") {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  const active = readActiveEncryptionKey();
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", active.key, nonce, {
    authTagLength: AES_GCM_TAG_BYTES,
  });
  cipher.setAAD(envelopeAad(active.keyId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const envelope: CustomerProfileEnvelope = {
    formatVersion: ENVELOPE_FORMAT_VERSION,
    keyId: active.keyId,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };

  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptCustomerProfileValue(packedValue: Buffer | Uint8Array | string) {
  const envelope = parseEnvelope(packedValue);
  const keyring = readEncryptionKeyring();
  const key = keyring.get(envelope.keyId);

  if (!key) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_KEY_UNKNOWN");
  }

  try {
    const nonce = decodeBase64(envelope.nonce, AES_GCM_NONCE_BYTES);
    const ciphertext = decodeBase64(envelope.ciphertext);
    const authTag = decodeBase64(envelope.authTag, AES_GCM_TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
      authTagLength: AES_GCM_TAG_BYTES,
    });
    decipher.setAAD(envelopeAad(envelope.keyId));
    decipher.setAuthTag(authTag);
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]),
    );
  } catch {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_DECRYPT_FAILED");
  }
}

export function packCustomerProfileValueForPostgres(plaintext: string | null) {
  if (plaintext === null) {
    return null;
  }

  return `\\x${encryptCustomerProfileValue(plaintext).toString("hex")}`;
}

export function normalizeCustomerProfileSearchValue(value: string) {
  if (typeof value !== "string") {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");

  if (!normalized) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  return normalized;
}

export function createCustomerProfileSearchToken(value: string) {
  const key = readKeyEntry(requireEnv(SEARCH_KEY_ENV));
  const normalized = normalizeCustomerProfileSearchValue(value);
  const digest = createHmac("sha256", key.key)
    .update("ghost.vip.customer-profile.exact-match.v1\0", "utf8")
    .update(normalized, "utf8")
    .digest("hex");

  return `v1:${key.keyId}:${digest}`;
}

export function createCustomerProfileRequestFingerprint(serializedCommand: string) {
  const key = readKeyEntry(requireEnv(SEARCH_KEY_ENV));
  const digest = createHmac("sha256", key.key)
    .update("ghost.vip.customer-profile.command.v1\0", "utf8")
    .update(serializedCommand, "utf8")
    .digest("hex");

  return `v1:${key.keyId}:${digest}`;
}

export function customerProfileSearchTokensEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readActiveEncryptionKey() {
  const configured = requireEnv(ACTIVE_ENCRYPTION_KEY_ENV);
  const parsedJson = tryParseJson(configured);

  if (isRecord(parsedJson) && typeof parsedJson.activeKeyId === "string" && isRecord(parsedJson.keys)) {
    const material = parsedJson.keys[parsedJson.activeKeyId];

    if (typeof material !== "string") {
      throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
    }

    return readKeyEntry(`${parsedJson.activeKeyId}:${material}`);
  }

  return readKeyEntry(configured);
}

function readEncryptionKeyring() {
  const active = readActiveEncryptionKey();
  const keyring = new Map<string, Buffer>([[active.keyId, active.key]]);
  const configured = process.env[ACTIVE_ENCRYPTION_KEY_ENV];
  const activeJson = configured ? tryParseJson(configured) : null;

  if (isRecord(activeJson) && isRecord(activeJson.keys)) {
    for (const [keyId, material] of Object.entries(activeJson.keys)) {
      if (typeof material !== "string") {
        throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
      }

      const entry = readKeyEntry(`${keyId}:${material}`);
      addKeyEntry(keyring, entry);
    }
  }

  const legacy = process.env[LEGACY_ENCRYPTION_KEYS_ENV]?.trim();

  if (!legacy) {
    return keyring;
  }

  const legacyJson = tryParseJson(legacy);

  if (isRecord(legacyJson)) {
    for (const [keyId, material] of Object.entries(legacyJson)) {
      if (typeof material !== "string") {
        throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
      }

      addKeyEntry(keyring, readKeyEntry(`${keyId}:${material}`));
    }

    return keyring;
  }

  for (const serialized of legacy.split(",")) {
    addKeyEntry(keyring, readKeyEntry(serialized.trim()));
  }

  return keyring;
}

function addKeyEntry(keyring: Map<string, Buffer>, entry: KeyEntry) {
  const existing = keyring.get(entry.keyId);

  if (existing && !timingSafeEqual(existing, entry.key)) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
  }

  keyring.set(entry.keyId, entry.key);
}

function readKeyEntry(serialized: string): KeyEntry {
  const trimmed = serialized.trim();
  let keyId: string | null = null;
  let material = trimmed;
  const separatorIndex = trimmed.indexOf(":");

  if (
    separatorIndex > 0 &&
    !trimmed.startsWith("base64:") &&
    !trimmed.startsWith("hex:")
  ) {
    keyId = trimmed.slice(0, separatorIndex);
    material = trimmed.slice(separatorIndex + 1);
  }

  const key = decodeKeyMaterial(material);
  const resolvedKeyId = keyId ?? `key-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;

  if (!KEY_ID_PATTERN.test(resolvedKeyId)) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
  }

  return { keyId: resolvedKeyId, key };
}

function decodeKeyMaterial(material: string) {
  let decoded: Buffer;

  if (material.startsWith("hex:")) {
    const hex = material.slice(4);

    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
    }

    decoded = Buffer.from(hex, "hex");
  } else {
    const base64 = material.startsWith("base64:") ? material.slice(7) : material;

    if (!isCanonicalBase64(base64)) {
      throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
    }

    decoded = Buffer.from(base64, "base64");
  }

  if (decoded.length !== KEY_BYTES) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_INVALID_CONFIG");
  }

  return decoded;
}

function parseEnvelope(packedValue: Buffer | Uint8Array | string): CustomerProfileEnvelope {
  const packed = decodePackedValue(packedValue);

  if (packed.length === 0 || packed.length > MAX_PACKED_ENVELOPE_BYTES) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  const parsed = tryParseJson(packed.toString("utf8"));

  if (
    !isRecord(parsed) ||
    parsed.formatVersion !== ENVELOPE_FORMAT_VERSION ||
    typeof parsed.keyId !== "string" ||
    !KEY_ID_PATTERN.test(parsed.keyId) ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.ciphertext !== "string" ||
    typeof parsed.authTag !== "string" ||
    Object.keys(parsed).some(
      (key) => !["formatVersion", "keyId", "nonce", "ciphertext", "authTag"].includes(key),
    )
  ) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  decodeBase64(parsed.nonce, AES_GCM_NONCE_BYTES);
  decodeBase64(parsed.ciphertext);
  decodeBase64(parsed.authTag, AES_GCM_TAG_BYTES);

  return parsed as CustomerProfileEnvelope;
}

function decodePackedValue(value: Buffer | Uint8Array | string) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (typeof value !== "string") {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  if (value.startsWith("\\x") && /^[0-9a-f]+$/i.test(value.slice(2)) && value.length % 2 === 0) {
    return Buffer.from(value.slice(2), "hex");
  }

  if (value.startsWith("{")) {
    return Buffer.from(value, "utf8");
  }

  const compactBase64 = value.replace(/\s+/g, "");

  if (!compactBase64) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  return decodeBase64(compactBase64);
}

function decodeBase64(value: string, expectedLength?: number) {
  if (!isCanonicalBase64(value)) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  const decoded = Buffer.from(value, "base64");

  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_ENVELOPE_INVALID");
  }

  return decoded;
}

function isCanonicalBase64(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return false;
  }

  return Buffer.from(value, "base64").toString("base64") === value;
}

function envelopeAad(keyId: string) {
  return Buffer.from(`ghost.vip.customer-profile.envelope.v${ENVELOPE_FORMAT_VERSION}:${keyId}`, "utf8");
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new CustomerProfileCryptoError("CUSTOMER_PROFILE_CRYPTO_NOT_CONFIGURED");
  }

  return value;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
