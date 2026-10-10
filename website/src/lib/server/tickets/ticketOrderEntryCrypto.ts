import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { TicketAuthKeyring } from "./ticketAuthCrypto";

export const ENTRY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const ENTRY_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
export const ENTRY_KEY_ID = /^[A-Za-z0-9._-]{1,64}$/u;
export type TicketOrderEntryBinding = Readonly<{
  linkId: string; orderId: string; eventSessionId: string; generation: number;
  environment: "test" | "live"; account: string; origin: string;
}>;
type EntryPurpose = "link" | "session" | "csrf" | "prepare" | "commit" | "request" | "challenge";

/** Separate KDF namespace from OTP, Wallet sessions, and delivery encryption. */
export function ticketEntryDigest(keyring: TicketAuthKeyring, purpose: EntryPurpose, value: string, keyId = keyring.activeKeyId) {
  if (!value || Buffer.byteLength(value) > 8192) throw invalid();
  return `v1:${keyId}:${createHmac("sha256", key(keyring, keyId, purpose)).update(value).digest("base64url")}`;
}

export function createTicketEntryMaterial(keyring: TicketAuthKeyring, binding: Omit<TicketOrderEntryBinding, "linkId">) {
  const bound = { ...binding, linkId: randomUUID() };
  const secret = randomBytes(32).toString("base64url");
  const keyId = keyring.activeKeyId;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyring, keyId, "delivery-encryption"), nonce);
  cipher.setAAD(bindingBytes(bound, keyId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Object.freeze({
    ...bound,
    verifier: ticketEntryDigest(keyring, "link", `${bound.linkId}:${secret}`, keyId),
    ciphertext: ["v1", keyId, nonce.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(":"),
  });
}

/** Ephemeral provider material only. Never log or persist the returned URL. */
export function decryptTicketEntryUrl(keyring: TicketAuthKeyring, value: unknown): string {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    const data = value as TicketOrderEntryBinding & { ciphertext: string };
    if (typeof data.ciphertext !== "string" || data.ciphertext.length > 2048) throw invalid();
    const [version, keyId, nonce, ciphertext, tag, extra] = data.ciphertext.split(":");
    if (version !== "v1" || extra !== undefined) throw invalid();
    const decipher = createDecipheriv("aes-256-gcm", key(keyring, keyId, "delivery-encryption"), decode(nonce, 12));
    decipher.setAAD(bindingBytes(data, keyId));
    decipher.setAuthTag(decode(tag, 16));
    const secret = Buffer.concat([decipher.update(decode(ciphertext, 43)), decipher.final()]).toString("utf8");
    if (!ENTRY_TOKEN.test(secret)) throw invalid();
    return `${data.origin}/tickets/order#${data.linkId}:${keyId}:${secret}`;
  } catch { throw invalid(); }
}

function key(keyring: TicketAuthKeyring, keyId: string, purpose: string) {
  if (!ENTRY_KEY_ID.test(keyId)) throw invalid();
  const master = keyring.keyFor(keyId);
  if (!master) throw invalid();
  return createHmac("sha256", master).update(`ghost.ticket-order-entry.v1\0${purpose}\0${keyId}`).digest();
}
function bindingBytes(b: TicketOrderEntryBinding, keyId: string) {
  const url = new URL(b.origin);
  if (!ENTRY_UUID.test(b.linkId) || !ENTRY_UUID.test(b.orderId) || !ENTRY_UUID.test(b.eventSessionId)
    || !Number.isSafeInteger(b.generation) || b.generation < 1 || !["test", "live"].includes(b.environment)
    || typeof b.account !== "string" || !/^(platform|acct_[A-Za-z0-9]{1,100})$/u.test(b.account)
    || url.protocol !== "https:" || url.origin !== b.origin) throw invalid();
  return Buffer.from(JSON.stringify(["ghost.ticket-order-entry.delivery.v1", keyId, b.linkId, b.orderId, b.eventSessionId, b.generation, b.environment, b.account, b.origin]));
}
function decode(value: string, bytes: number) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw invalid();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== bytes || decoded.toString("base64url") !== value) throw invalid();
  return decoded;
}
function invalid() { return new Error("TICKET_ORDER_ENTRY_CRYPTO_INVALID"); }
