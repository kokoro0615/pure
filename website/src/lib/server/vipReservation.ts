import { sha256Hex } from "./hash";
import { isPublicLocale, type PublicLocale } from "@/lib/publicLocale";

export type PublicHoldRequest = {
  publicSlotId: string;
  publicOfferingId: string;
  guestCount: number;
  publicResourceCode?: string | null;
  paymentType?: "card_setup" | "deposit";
  depositAmountYen?: number;
  turnstileToken?: string | null;
  gclid?: string | null;
  /** Page language for the Stripe return URL; not part of the request fingerprint. */
  locale?: PublicLocale | null;
  customer: {
    email?: string | null;
    phone?: string | null;
  };
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value?: string | null) {
  const raw = value?.trim() ?? "";
  const stripped = raw.replace(/[^\d+]/g, "");
  const normalized = stripped.startsWith("+")
    ? `+${stripped.slice(1).replace(/\+/g, "")}`
    : stripped.replace(/\+/g, "");

  return normalized || null;
}

export function isValidCustomerEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidCustomerPhone(value: string) {
  return /^\+?\d{8,15}$/.test(value);
}

export function hashOptionalValue(value?: string | null) {
  if (!value) {
    return null;
  }

  return sha256Hex(`${requireReservationHashSalt()}:${value}`);
}

export function parsePublicHoldRequest(payload: unknown): PublicHoldRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_json_body");
  }

  const record = payload as Record<string, unknown>;
  const customer =
    record.customer && typeof record.customer === "object"
      ? (record.customer as Record<string, unknown>)
      : {};
  const publicSlotId = readRequiredString(record.publicSlotId, "publicSlotId");
  const publicOfferingId = readRequiredString(record.publicOfferingId, "publicOfferingId");
  // guestCount flows into int4 RPC parameters: keep it inside the same
  // bookable-party range the availability reads and the admin hold parser use,
  // so absurd values are a clean 400 instead of a SQL overflow.
  const guestCount = readBoundedPositiveInteger(record.guestCount, "guestCount", 99);
  const paymentType = readPaymentType(record.paymentType);
  // depositAmountYen is compared for exact equality with the catalog
  // min_spend_yen before any RPC call; the ceiling keeps the value inside int4
  // and far above any legitimate VIP minimum spend.
  const depositAmountYen =
    record.depositAmountYen === undefined
      ? undefined
      : readBoundedNonNegativeInteger(record.depositAmountYen, "depositAmountYen", 999_999_999);
  const email = readOptionalString(customer.email);
  const phone = readOptionalString(customer.phone);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    throw new Error("missing_customer_contact");
  }

  if (normalizedEmail && !isValidCustomerEmail(normalizedEmail)) {
    throw new Error("invalid_customer_email");
  }

  if (normalizedPhone && !isValidCustomerPhone(normalizedPhone)) {
    throw new Error("invalid_customer_phone");
  }

  return {
    publicSlotId,
    publicOfferingId,
    guestCount,
    publicResourceCode: readOptionalString(record.publicResourceCode),
    paymentType,
    depositAmountYen,
    turnstileToken: readOptionalString(record.turnstileToken),
    gclid: readAdClickId(record.gclid),
    locale: isPublicLocale(record.locale) ? record.locale : null,
    customer: {
      email,
      phone,
    },
  };
}

export function publicHoldRequestFingerprint(request: PublicHoldRequest) {
  return sha256Hex(`${requireReservationHashSalt()}:${stableJsonStringify(toFingerprintPayload(request))}`);
}

export function toFingerprintPayload(request: PublicHoldRequest): JsonValue {
  return {
    publicSlotId: request.publicSlotId,
    publicOfferingId: request.publicOfferingId,
    guestCount: request.guestCount,
    publicResourceCode: request.publicResourceCode ?? null,
    paymentType: request.paymentType ?? "card_setup",
    depositAmountYen: request.depositAmountYen ?? 0,
    customer: {
      email: normalizeEmail(request.customer.email),
      phone: normalizePhone(request.customer.phone),
    },
  };
}

export function stableJsonStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJsonStringify(entryValue)}`)
    .join(",")}}`;
}

function readRequiredString(value: unknown, fieldName: string) {
  const stringValue = readOptionalString(value);

  if (!stringValue) {
    throw new Error(`missing_${fieldName}`);
  }

  return stringValue;
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

// Click ids are opaque provider tokens. Reject only shapes that are clearly not
// one; a malformed value must never fail a booking, so it drops to null.
function readAdClickId(value: unknown) {
  const parsed = readOptionalString(value);
  if (!parsed || parsed.length > 500 || /\s/.test(parsed)) {
    return null;
  }

  return parsed;
}

function readBoundedPositiveInteger(value: unknown, fieldName: string, max: number) {
  const parsed = readInteger(value, fieldName);

  if (parsed <= 0 || parsed > max) {
    throw new Error(`invalid_${fieldName}`);
  }

  return parsed;
}

function readBoundedNonNegativeInteger(value: unknown, fieldName: string, max: number) {
  const parsed = readInteger(value, fieldName);

  if (parsed < 0 || parsed > max) {
    throw new Error(`invalid_${fieldName}`);
  }

  return parsed;
}

function readInteger(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`invalid_${fieldName}`);
  }

  return value;
}

function readPaymentType(value: unknown) {
  if (value === undefined || value === null) {
    return "card_setup";
  }

  if (value === "card_setup" || value === "deposit") {
    return value;
  }

  throw new Error("invalid_paymentType");
}

function requireReservationHashSalt() {
  const salt = process.env.RESERVATION_HASH_SALT;

  if (!salt) {
    throw new Error("reservation_hash_salt_required");
  }

  return salt;
}
