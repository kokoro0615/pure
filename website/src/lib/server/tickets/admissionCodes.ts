import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import "server-only";

import { optionalServerEnv, requireServerEnv } from "../env";

/*
 * An admission code is a bearer credential: whoever presents it gets in. So it
 * is generated from CSPRNG bytes rather than derived from anything guessable
 * such as the order code or a sequence number.
 *
 * Crockford base32 (no I, L, O, U) so a code can be read aloud or typed at the
 * door when a phone screen is unreadable, without ambiguity.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ADMISSION_CODE_BYTES = 20; // 160 bits
const PUBLIC_CODE_LENGTH = 10;

function encodeBase32(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function generateAdmissionCode() {
  return `adm_${encodeBase32(randomBytes(ADMISSION_CODE_BYTES))}`;
}

export function generateAdmissionCodes(count: number) {
  return Array.from({ length: count }, () => generateAdmissionCode());
}

/** Human-facing order code. Matches ticket_orders_public_code_shape. */
export function generateTicketOrderCode() {
  let code = "";
  while (code.length < PUBLIC_CODE_LENGTH) {
    code += encodeBase32(randomBytes(8));
  }
  return `GT-${code.slice(0, PUBLIC_CODE_LENGTH)}`;
}

/*
 * The completion page and the emailed link both need to re-open a ticket after
 * the tab is closed, without letting anyone enumerate other people's orders.
 * The link therefore carries a keyed token over the order id, not the id alone.
 *
 * One secret, two jobs — signing links and indexing purchaser email — so each
 * job gets its own derived key rather than using the master directly. Without
 * that separation the two constructions share a key for no reason, and neither
 * can be reasoned about on its own.
 */
const TOKEN_VERSION = "v3";
const LEGACY_TOKEN_VERSION = "v2";
const LINK_TOKEN_INFO = "ghost.ticket.link-token.v3";
const LEGACY_LINK_TOKEN_INFO = "ghost.ticket.link-token.v2";
const EMAIL_INDEX_INFO = "ghost.ticket.email-index.v2";

/*
 * A link is a bearer credential for one order, and URLs leak through history,
 * screenshots and shared devices. It is bounded rather than eternal: 180 days
 * is far past any event the link could be for, and a leak older than that stops
 * working on its own. A leak inside the window is handled by revoking the
 * order, which voids the admissions the link would show.
 */
const LINK_TOKEN_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;
const EVENT_SUPPORT_DAYS = 8;

function ticketMasterKey() {
  return requireServerEnv("TICKET_LINK_SECRET");
}

function derivedKey(info: string) {
  return createHmac("sha256", ticketMasterKey()).update(info, "utf8").digest();
}

export function isTicketLinkSecretConfigured() {
  const value = optionalServerEnv("TICKET_LINK_SECRET");
  return typeof value === "string" && value.length >= 32;
}

function eventSupportExpiry(eventDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(eventDate)) throw new Error("ticket_link_expiry_invalid");
  // `+09:00` makes this independent of the server's timezone. Noon on D+8 is
  // seven full support days after an overnight event has closed on D+1.
  const start = Date.parse(`${eventDate}T12:00:00+09:00`);
  if (!Number.isFinite(start)) throw new Error("ticket_link_expiry_invalid");
  return start + EVENT_SUPPORT_DAYS * 86_400_000;
}

export function createTicketAccessToken(orderId: string, eventDate: string, now = Date.now()) {
  const absoluteCap = now + LINK_TOKEN_MAX_AGE_SECONDS * 1000;
  const expiresAtMs = Math.min(eventSupportExpiry(eventDate), absoluteCap);
  if (expiresAtMs <= now) throw new Error("ticket_link_expiry_invalid");
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const payload = `${TOKEN_VERSION}.${expiresAtSeconds}`;
  const signature = createHmac("sha256", derivedKey(LINK_TOKEN_INFO))
    .update(`${payload}.${orderId}`, "utf8")
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyTicketAccessToken(
  orderId: string,
  token: string | null | undefined,
  now = Date.now(),
) {
  if (!token || token.length > 256) return false;
  const [version, encodedExpiresAt, signature, extra] = token.split(".");
  if (
    (version !== TOKEN_VERSION && version !== LEGACY_TOKEN_VERSION)
    || !signature
    || extra !== undefined
  ) return false;
  if (!/^\d{10,12}$/u.test(encodedExpiresAt ?? "")) return false;

  const expiresAtSeconds = Number(encodedExpiresAt);
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= Math.floor(now / 1000)) {
    return false;
  }

  const tokenInfo = version === LEGACY_TOKEN_VERSION ? LEGACY_LINK_TOKEN_INFO : LINK_TOKEN_INFO;
  const expected = createHmac("sha256", derivedKey(tokenInfo))
    .update(`${version}.${encodedExpiresAt}.${orderId}`, "utf8")
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Keyed hash of the purchaser email, so an order can be found without storing PII in the clear. */
export function normalizeTicketPurchaserEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function hashPurchaserEmail(email: string) {
  const normalized = normalizeTicketPurchaserEmail(email);
  if (!normalized) return null;
  return createHmac("sha256", derivedKey(EMAIL_INDEX_INFO)).update(normalized, "utf8").digest("hex");
}
