import { formatTicketDeadline, readTicketCommercialSnapshot, TICKET_GROUP_ENTRY_SHORT, TICKET_POLICIES, type TicketCommercialSnapshot } from "../../tickets/ticketCommercialTerms";
import { createHash } from "node:crypto";
import "server-only";

import type Stripe from "stripe";

import { serializeTicketCartItems } from "../../tickets/ticketCart";
import { createTicketAccessToken } from "./admissionCodes";
import { isPublicLocale, type PublicLocale } from "../../publicLocale";
import { STRIPE_LOCALES } from "../../../data/vipCheckoutLocales";
import { translatedIssuedTicketPolicy } from "../../../data/ticketPolicyLocales";

export const TICKET_CHECKOUT_PROVIDER_REQUEST_VERSION = "ghost.ticket-checkout-provider.v28";

export type TicketCheckoutProviderRequestSnapshot = Readonly<{
  checkoutExpiresAt?: string | null;
  eventSessionId: string;
  checkInMode: "legacy_qr" | "wallet_swipe";
  publicCode: string;
  eventId: string;
  eventSlug: string;
  eventDate: string;
  eventTitle: string;
  amountYen: number;
  totalQuantity: number;
  items: readonly Readonly<{
    ticketTypeId: string;
    label: string;
    quantity: number;
    unitPriceYen: number;
    commercial?: TicketCommercialSnapshot;
  }>[];
}>;

export type TicketCheckoutProviderRequest = Readonly<{
  version: typeof TICKET_CHECKOUT_PROVIDER_REQUEST_VERSION;
  origin: string;
  createdAt: string;
  hash: string;
  parameters: Stripe.Checkout.SessionCreateParams;
}>;

/**
 * Rebuild the complete immutable Stripe create request. The fixed timestamp is
 * essential for legacy ticket-link signatures: retrying with Date.now() would
 * silently change success_url while reusing the Stripe idempotency key.
 */
type TicketCheckoutProviderRequestInput = Readonly<{
  snapshot: TicketCheckoutProviderRequestSnapshot;
  origin: string;
  requestCreatedAt: string;
  checkoutActionId: string;
  orderId: string;
  canaryRunId?: string | null;
  /**
   * Page language for Stripe Checkout and the return URLs. null reproduces the
   * byte-identical request created before languages were passed (locale auto,
   * bilingual Japanese/English copy), so earlier sealed requests still match.
   */
  locale?: PublicLocale | null;
}>;

export const TICKET_CHECKOUT_PROVIDER_LOCALES: readonly (PublicLocale | null)[] = [null, "ja", "en", "pt", "ko"];

/**
 * Rebuild a sealed request. The seal stores only its hash, so try the
 * caller's language first and then every other supported variant; a request
 * sealed in any language (or before languages existed) is recovered exactly.
 * When none matches, the first candidate is returned and the caller's hash
 * comparison routes the action to review as before.
 */
export function buildSealedTicketCheckoutProviderRequest(
  input: Omit<TicketCheckoutProviderRequestInput, "locale">,
  sealedHash: string,
  preferredLocale: PublicLocale | null = null,
): TicketCheckoutProviderRequest {
  const candidates = [preferredLocale, ...TICKET_CHECKOUT_PROVIDER_LOCALES.filter(locale => locale !== preferredLocale)];
  let first: TicketCheckoutProviderRequest | null = null;
  for (const locale of candidates) {
    const request = buildTicketCheckoutProviderRequest({ ...input, locale });
    first ??= request;
    if (request.hash === sealedHash) return request;
  }
  return first!;
}

export function buildTicketCheckoutProviderRequest(input: TicketCheckoutProviderRequestInput): TicketCheckoutProviderRequest {
  const origin = canonicalCheckoutOrigin(input.origin);
  const requestCreatedAtMs = Date.parse(input.requestCreatedAt);
  if (
    !Number.isFinite(requestCreatedAtMs)
    || new Date(requestCreatedAtMs).toISOString() !== input.requestCreatedAt
  ) {
    throw new Error("ticket_checkout_provider_request_invalid");
  }

  const { snapshot } = input;
  const locale = input.locale ?? null;
  if (locale !== null && !isPublicLocale(locale)) throw new Error("ticket_checkout_provider_request_invalid");
  // Japanese is the default page language and carries no `lang` query.
  const langQuery = locale === null || locale === "ja" ? "" : `&lang=${locale}`;
  const commercialItems = snapshot.items.filter(item => item.commercial !== undefined);
  const commercial = commercialItems.length ? readTicketCommercialSnapshot(commercialItems[0].commercial) : null;
  if (commercial && (commercialItems.length !== snapshot.items.length || commercialItems.some(item => {
    const other = readTicketCommercialSnapshot(item.commercial);
    return other.version !== commercial.version || other.serviceDate !== snapshot.eventDate || canonicalJson(other.policies) !== canonicalJson(commercial.policies);
  }))) throw new Error("ticket_commercial_snapshot_invalid");
  const canaryRunId = input.canaryRunId ?? null;
  if (
    canaryRunId !== null
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(canaryRunId)
  ) {
    throw new Error("ticket_checkout_provider_request_invalid");
  }
  const metadata = {
    ...(commercial ? { ticket_terms_version: commercial.version,
      ticket_terms_sha256: createHash("sha256").update(canonicalJson(snapshot.items.map(item => item.commercial))).digest("hex") } : {}),
    source_system: "pure_web",
    flow: "ticket_calendar",
    ticket_order_id: input.orderId,
    ticket_order_code: snapshot.publicCode,
    ticket_checkout_action_id: input.checkoutActionId,
    ticket_event_session_id: snapshot.eventSessionId,
    ticket_check_in_mode: snapshot.checkInMode,
    event_id: snapshot.eventId,
    event_slug: snapshot.eventSlug,
    ticket_type_id: snapshot.items.length === 1 ? snapshot.items[0].ticketTypeId : "mixed",
    ticket_items: serializeTicketCartItems(snapshot.items),
    ticket_type_count: String(snapshot.items.length),
    quantity: String(snapshot.totalQuantity),
    ...(canaryRunId === null ? {} : { ghost_ticket_canary_run_id: canaryRunId }),
  };
  const successUrl = snapshot.checkInMode === "wallet_swipe"
    ? `${origin}/tickets/wallet?checkout=complete&session_id={CHECKOUT_SESSION_ID}`
    : `${origin}/tickets/complete?order=${encodeURIComponent(input.orderId)}`
      + `&t=${encodeURIComponent(createTicketAccessToken(
        input.orderId,
        snapshot.eventDate,
        requestCreatedAtMs,
      ))}`
      + "&session_id={CHECKOUT_SESSION_ID}";
  const localizedSuccessUrl = successUrl + langQuery;
  const parameters: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    ...(commercial ? { custom_text: { submit: { message: locale === null
      ? `支払期限 / Pay by: ${formatTicketDeadline(snapshot.checkoutExpiresAt ?? commercial.salesEndsAt)}\n${commercial.policies.refundCancellation.ja}\n${commercial.policies.refundCancellation.en}${commercial.admissionPolicy === "order_together_v1" ? `\n${TICKET_GROUP_ENTRY_SHORT.ja}\n${TICKET_GROUP_ENTRY_SHORT.en}` : ""}\n[購入条件 / Terms](${origin}/tickets/terms?version=${encodeURIComponent(commercial.version)}) · [販売者 / Seller](${origin}/tickets/legal) · [Privacy](${origin}/contact#privacy-policy)`
      : localizedSubmitMessage(locale, {
        deadline: formatTicketDeadline(snapshot.checkoutExpiresAt ?? commercial.salesEndsAt),
        refund: localizedClause(locale, "refundCancellation", commercial.policies.refundCancellation),
        group: commercial.admissionPolicy === "order_together_v1" ? GROUP_ENTRY_SHORT[locale] : null,
        terms: `${origin}/tickets/terms?version=${encodeURIComponent(commercial.version)}${langQuery}`,
        legal: `${origin}/tickets/legal${langQuery ? `?${langQuery.slice(1)}` : ""}`,
        privacy: `${origin}/contact${langQuery ? `?${langQuery.slice(1)}` : ""}#privacy-policy`,
      }),
    } } } : {}),
    ...(snapshot.checkoutExpiresAt ? {expires_at: readCheckoutExpiry(snapshot.checkoutExpiresAt,requestCreatedAtMs)} : {}),
    locale: locale === null ? "auto" : STRIPE_LOCALES[locale],
    client_reference_id: input.orderId,
    success_url: localizedSuccessUrl,
    cancel_url: `${origin}/tickets?checkout=cancelled&event=${encodeURIComponent(snapshot.eventId)}${langQuery}`,
    phone_number_collection: { enabled: true },
    ...(snapshot.checkInMode === "wallet_swipe" ? { customer_creation: "always" as const } : {}),
    payment_intent_data: { metadata },
    line_items: snapshot.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "jpy",
        unit_amount: item.unitPriceYen,
        product_data: {
          name: `${snapshot.eventTitle} - ${locale === null ? item.label : localizedProductLabel(locale, item.ticketTypeId, item.label)}`,
          description: item.commercial
            ? (locale === null
              ? `${snapshot.eventDate} ${item.commercial.doorTime}–${item.commercial.closeTime <= item.commercial.doorTime ? "翌日/next day " : ""}${item.commercial.closeTime} JST / ${item.commercial.descriptionJa} / ${item.commercial.descriptionEn} / 税込 Tax included / 決済確認後発券 Ticket issued after payment`
              : localizedProductDescription(locale, snapshot.eventDate, item.commercial)).slice(0, 500)
            : `${formatEventDateForStripe(snapshot.eventDate)} JST / ${item.label}`,
          metadata: {
            event_id: snapshot.eventId,
            event_slug: snapshot.eventSlug,
            ticket_type_id: item.ticketTypeId,
          },
        },
      },
    })),
    metadata,
  };
  return Object.freeze({
    version: TICKET_CHECKOUT_PROVIDER_REQUEST_VERSION,
    origin,
    createdAt: input.requestCreatedAt,
    hash: createHash("sha256").update(canonicalJson(parameters), "utf8").digest("hex"),
    parameters,
  });
}

function canonicalCheckoutOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ticket_checkout_provider_request_invalid");
  }
  const loopback = url.hostname === "localhost"
    || url.hostname === "127.0.0.1"
    || url.hostname === "[::1]";
  if (
    url.origin !== value
    || url.username
    || url.password
    || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))
  ) {
    throw new Error("ticket_checkout_provider_request_invalid");
  }
  return url.origin;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function formatEventDateForStripe(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function readCheckoutExpiry(value: string, createdAt: number): number {
  const expiry=Date.parse(value);
  if (!Number.isFinite(expiry) || expiry-createdAt<30*60_000 || expiry-createdAt>24*60*60_000) throw new Error("ticket_checkout_expiry_invalid");
  return Math.floor(expiry/1000);
}

// Checkout copy in one language. Japanese and English reuse the stored terms
// record; Portuguese and Korean translate the same clause (unknown wording
// falls back to the stored English record rather than inventing a translation).
const PRODUCT_LABELS: Readonly<Record<string, Readonly<Record<PublicLocale, string>>>> = {
  "general-men": { ja: "一般入場 メンズ", en: "General Admission Men", pt: "Entrada geral · Homens", ko: "일반 입장 · 남성" },
  "general-women": { ja: "一般入場 レディース", en: "General Admission Women", pt: "Entrada geral · Mulheres", ko: "일반 입장 · 여성" },
  "fast-entry-unlimited-drink-men": { ja: "優先入場 + 飲み放題 男性", en: "Fast Entry + Unlimited Drink · Men", pt: "Entrada prioritária + Bebidas ilimitadas · Homens", ko: "우선 입장 + 무제한 음료 · 남성" },
  "fast-entry-unlimited-drink-women": { ja: "優先入場 + 飲み放題 女性", en: "Fast Entry + Unlimited Drink · Women", pt: "Entrada prioritária + Bebidas ilimitadas · Mulheres", ko: "우선 입장 + 무제한 음료 · 여성" },
};
const PRODUCT_DESCRIPTIONS: Readonly<Record<string, Readonly<Record<"pt" | "ko", string>>>> = {
  "通常入場チケット。IDチェックが必要です。": { pt: "Ingresso de entrada padrão. É obrigatória a verificação do documento de identificação.", ko: "일반 입장 티켓입니다. 신분증 확인이 필요합니다." },
  "ピークタイムの優先入場。ドリンクパス付き。": { pt: "Entrada prioritária nos horários de maior movimento. Inclui passe de bebidas.", ko: "혼잡 시간대 우선 입장. 음료 패스 포함." },
};
const GROUP_ENTRY_SHORT: Readonly<Record<PublicLocale, string>> = {
  ja: TICKET_GROUP_ENTRY_SHORT.ja,
  en: TICKET_GROUP_ENTRY_SHORT.en,
  pt: "Todos os convidados do mesmo pedido devem entrar juntos. Não é permitida a entrada separada.",
  ko: "같은 주문의 일행은 모두 함께 입장해야 합니다. 개별 입장은 불가합니다.",
};
const SUBMIT_COPY: Readonly<Record<PublicLocale, Readonly<{ payBy: string; terms: string; seller: string; privacy: string }>>> = {
  ja: { payBy: "支払期限", terms: "購入条件", seller: "販売者情報", privacy: "プライバシーポリシー" },
  en: { payBy: "Pay by", terms: "Terms", seller: "Seller", privacy: "Privacy" },
  pt: { payBy: "Pague até", terms: "Condições", seller: "Vendedor", privacy: "Privacidade" },
  ko: { payBy: "결제 기한", terms: "구매 조건", seller: "판매자 정보", privacy: "개인정보 처리방침" },
};
const PRODUCT_COPY: Readonly<Record<PublicLocale, Readonly<{ nextDay: string; tax: string; issued: string }>>> = {
  ja: { nextDay: "翌日", tax: "税込", issued: "決済確認後発券" },
  en: { nextDay: "next day", tax: "Tax included", issued: "Ticket issued after payment" },
  pt: { nextDay: "dia seguinte", tax: "Impostos incluídos", issued: "Ingresso emitido após o pagamento" },
  ko: { nextDay: "다음 날", tax: "세금 포함", issued: "결제 확인 후 발권" },
};

function localizedClause(locale: PublicLocale, key: keyof typeof TICKET_POLICIES, record: Readonly<{ ja: string; en: string }>) {
  return translatedIssuedTicketPolicy(locale, key, record, TICKET_POLICIES) ?? record.en;
}

function localizedSubmitMessage(locale: PublicLocale, parts: Readonly<{ deadline: string; refund: string; group: string | null; terms: string; legal: string; privacy: string }>) {
  const copy = SUBMIT_COPY[locale];
  return `${copy.payBy}: ${parts.deadline}\n${parts.refund}${parts.group ? `\n${parts.group}` : ""}\n[${copy.terms}](${parts.terms}) · [${copy.seller}](${parts.legal}) · [${copy.privacy}](${parts.privacy})`;
}

function localizedProductLabel(locale: PublicLocale, ticketTypeId: string, storedLabel: string) {
  return PRODUCT_LABELS[ticketTypeId]?.[locale] ?? storedLabel;
}

function localizedProductDescription(locale: PublicLocale, eventDate: string, commercial: TicketCommercialSnapshot) {
  const copy = PRODUCT_COPY[locale];
  const description = locale === "ja" ? commercial.descriptionJa
    : locale === "en" ? commercial.descriptionEn
      : PRODUCT_DESCRIPTIONS[commercial.descriptionJa]?.[locale] ?? commercial.descriptionEn;
  const nextDay = commercial.closeTime <= commercial.doorTime ? `${copy.nextDay} ` : "";
  return `${eventDate} ${commercial.doorTime}–${nextDay}${commercial.closeTime} JST / ${description} / ${copy.tax} / ${copy.issued}`;
}
