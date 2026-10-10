/** Append new versions; never edit terms attached to an existing paid order. */
export const LEGACY_TICKET_TERMS_VERSION = "2026-09-08.1";
export const GROUP_TICKET_TERMS_VERSION = "2026-09-13.1";
export const DRINK_TICKET_TERMS_VERSION = "2026-09-14.1";
export const TICKET_TERMS_VERSION = "2026-09-22.1";
/**
 * Every terms version that may appear on an issued or in-flight order.
 * `ticketPoliciesForVersion` must resolve every entry forever: checkout
 * replay, provider-request rebuild, receipts and purchase emails read the
 * immutable stored snapshot through it. Removing a version strands those
 * orders behind `ticket_commercial_snapshot_invalid` — append only.
 * Guarded by tests/ticket-terms-version-registry.test.mjs.
 */
export const ISSUED_TICKET_TERMS_VERSIONS = Object.freeze([
  LEGACY_TICKET_TERMS_VERSION,
  GROUP_TICKET_TERMS_VERSION,
  DRINK_TICKET_TERMS_VERSION,
  TICKET_TERMS_VERSION,
]);
export const PLANNED_TICKET_ORIGIN = "https://www.club-pure.com";
export const TICKET_SELLER = {
  name: "Pure Osaka",
  address: "〒542-0085 大阪府大阪市中央区心斎橋筋2-3-12 ダイヤモンドビル B1F",
  phone: "06-6214-6600",
  phoneHref: "tel:+81662146600",
  supportUrl: "https://www.instagram.com/pure_osaka/",
} as const;

export const LEGACY_TICKET_POLICIES = {
  age: {
    ja: "20歳以上の方が入場できます。",
    en: "Admission is for ages 20 and over.",
  },
  identity: {
    ja: "入場者全員の顔写真付き身分証明書をご提示ください。年齢・本人確認ができない場合は入場できません。",
    en: "Every guest must present photo ID. Entry requires age and identity verification.",
  },
  price: {
    ja: "表示価格は1名分・税込です。オンライン購入手数料はかかりません。対象外ドリンク・再入場など任意の追加サービスは別料金です。",
    en: "Prices are per guest, tax included, with no additional online booking fee. Optional drinks outside the pass and reentry are charged separately.",
  },
  payment: {
    ja: "Stripe決済画面に表示される方法で購入時にお支払いください。決済画面の期限までに支払いを完了してください。",
    en: "Pay at purchase using a method offered by Stripe, before the Checkout expiry shown.",
  },
  provision: {
    ja: "決済確認後に電子チケットを発行します。購入済みチケットはWalletで確認できます。サービスは選択した営業日の営業時間内に提供します。",
    en: "Your electronic ticket is issued after payment confirmation and is available in Wallet. Service is provided during the selected night's hours.",
  },
  refundCancellation: {
    ja: "お客様都合のキャンセル・日付変更・未使用・遅刻による返金は原則できません。主催者による開催中止・開催日変更は、未使用券を元のお支払い方法へ全額返金し、当店の返金手数料は差し引きません。当店の責任で利用できなかった場合は個別対応します。法令に基づく権利を制限するものではありません。",
    en: "No refunds for customer cancellations, date changes, no-shows or late arrival. If we cancel or change the event date, unused tickets are refunded in full to the original payment method with no PURE refund deduction. Venue-attributable service failures are handled individually. Statutory rights remain unaffected.",
  },
  wristbandReentry: {
    ja: "初回入場時に腕へスタンプを押します。再入場を希望する場合は退店時にスタッフから再入場カードを受け取り、再入場時にカードをご提示のうえ500円をお支払いください。チケットの再スワイプは不要です。",
    en: "Staff stamp your arm at first entry. Collect a reentry card from staff when leaving; present it and pay JPY500 when returning. Do not swipe the ticket again.",
  },
  multipleTickets: {
    ja: "複数枚は購入者と同行者の入場に利用できます。購入者がチケットを提示し、入場者全員が本人確認を受けてください。",
    en: "Multiple tickets cover the purchaser and accompanying guests. The purchaser presents the tickets and every guest completes ID checks.",
  },
  transfer: {
    ja: "転売・第三者への譲渡はできません。Walletのログイン、確認コード、パスキーを他人と共有しないでください。",
    en: "Resale and transfer are not supported or permitted. Do not share Wallet access, verification codes or passkeys.",
  },
  connectivity: {
    ja: "入場操作には通信が必要です。スタッフがサーバーの確定結果を確認してからご入場ください。端末・通信・メールの問題は入場スタッフへお申し出ください。",
    en: "Entry requires connectivity and staff verification of the server-confirmed result. Ask entry staff for help with device, connection or email problems.",
  },
  drinkScope: {
    ja: "飲み放題パスは当日の営業時間内、店舗の飲み放題対象メニューに適用します。対象外のプレミアムドリンク・ボトルは別料金です。他の方との共有はできません。安全のため提供をお断りする場合があります。一般入場券に飲み放題は含まれません。",
    en: "The drink pass covers the venue's designated unlimited-drink menu during that night's hours. Premium drinks and bottles outside that menu cost extra. No sharing; service may be refused for safety. General admission does not include unlimited drinks.",
  },
  support: {
    ja: "お問い合わせ・返金のご相談は公式Instagramまたは06-6214-6600へ、注文番号と営業日を添えてご連絡ください。返金の反映時期は決済方法・金融機関により異なります。",
    en: "Contact official Instagram or +81-6-6214-0545 with your order number and event date for support or refunds. Refund posting time varies by payment method and bank.",
  },
} as const;

export const TICKET_GROUP_ENTRY_NOTICE = {
  ja: "複数枚をご購入の場合は、全員同時入場が必須です。購入者と同行者全員がそろってから、購入者のスマートフォンでチケットをご提示ください。分かれての入場はできません。スタッフのスワイプによるチェックインが完了すると、この注文のチケットはすべて使用済みとなり、再度使用することはできません。",
  en: "All guests in the same order must enter together. The purchaser and all accompanying guests must arrive together and present the tickets on the purchaser’s smartphone. Separate entry is not available. Once staff complete check-in by swiping, all tickets in the order are marked as used and cannot be used again.",
} as const;
export const TICKET_GROUP_ENTRY_SHORT = {
  ja: "複数枚は全員同時入場必須・分かれての入場不可",
  en: "All guests in the same order must enter together. Separate entry is not available.",
} as const;
export const GROUP_TICKET_POLICIES = {
  ...LEGACY_TICKET_POLICIES,
  multipleTickets: TICKET_GROUP_ENTRY_NOTICE,
  transfer: {
    ja: "転売・第三者への譲渡はできません。注文専用リンク、Walletのログイン、確認コード、パスキーを他人と共有しないでください。",
    en: "Resale and transfer are not supported or permitted. Do not share the order link, Wallet access, verification codes or passkeys.",
  },
} as const;
export const TICKET_DRINK_SAFETY = {
  ja: "泥酔されている場合や、安全上問題があるとスタッフが判断した場合は、アルコール類の提供をお断りすることがあります。",
  en: "We may refuse to serve alcohol if you are heavily intoxicated or staff determine that there is a safety concern.",
} as const;
export const DRINK_TICKET_POLICIES = {
  ...GROUP_TICKET_POLICIES,
  wristbandReentry: {
    ja: "再入場を希望する場合は退店時にスタッフから再入場カードを受け取り、再入場時にカードをご提示のうえ500円をお支払いください。チケットの再スワイプは不要です。",
    en: "Collect a reentry card from staff when leaving; present it and pay JPY500 when returning. Do not swipe the ticket again.",
  },
  drinkScope: {
    ja: `飲み放題パスは当日の営業時間内、店舗の飲み放題対象メニューに適用します。対象外のプレミアムドリンク・ボトルは別料金です。他の方との共有はできません。${TICKET_DRINK_SAFETY.ja}一般入場券に飲み放題は含まれません。`,
    en: `The drink pass covers the venue's designated unlimited-drink menu during that night's hours. Premium drinks and bottles outside that menu cost extra. No sharing. ${TICKET_DRINK_SAFETY.en} General admission does not include unlimited drinks.`,
  },
} as const;

// Owner-confirmed PURE age policy. Earlier paid snapshots remain unchanged.
export const TICKET_POLICIES = {
  ...DRINK_TICKET_POLICIES,
  support: {
    ...DRINK_TICKET_POLICIES.support,
    en: "Contact official Instagram or +81-6-6214-6600 with your order number and event date for support or refunds. Refund posting time varies by payment method and bank.",
  },
  age: {
    ja: "18歳以上の方が入場できます。飲酒は20歳以上に限ります。",
    en: "Admission is for ages 18 and over. Alcohol is only served to guests aged 20 and over.",
  },
} as const;

/** Current operational corrections are separate from the immutable purchase record. */
export function ticketOperationalPolicies(snapshot?: TicketCommercialSnapshot) {
  return {
    ...(snapshot?.policies ?? TICKET_POLICIES),
    age: TICKET_POLICIES.age,
    support: TICKET_POLICIES.support,
    wristbandReentry: TICKET_POLICIES.wristbandReentry,
    drinkScope: TICKET_POLICIES.drinkScope,
  };
}
export function isGroupTicketTermsVersion(version: string) {
  return (
    version === GROUP_TICKET_TERMS_VERSION ||
    version === DRINK_TICKET_TERMS_VERSION ||
    version === TICKET_TERMS_VERSION
  );
}
export function ticketPoliciesForVersion(version: string) {
  if (version === TICKET_TERMS_VERSION) return TICKET_POLICIES;
  if (version === DRINK_TICKET_TERMS_VERSION) return DRINK_TICKET_POLICIES;
  if (version === GROUP_TICKET_TERMS_VERSION) return GROUP_TICKET_POLICIES;
  if (version === LEGACY_TICKET_TERMS_VERSION) return LEGACY_TICKET_POLICIES;
  return null;
}

export type TicketCommercialSnapshot = Readonly<{
  version: string;
  admissionPolicy?: "order_together_v1";
  policies: Readonly<
    Record<keyof typeof TICKET_POLICIES, Readonly<{ ja: string; en: string }>>
  >;
  descriptionJa: string;
  descriptionEn: string;
  serviceDate: string;
  doorTime: string;
  closeTime: string;
  salesEndsAt: string;
}>;

export function createTicketCommercialSnapshot(
  event: { date: string; doorTime: string; closeTime: string },
  product: {
    descriptionJa: string;
    descriptionEn: string;
    salesEndsAt: string;
  },
): TicketCommercialSnapshot {
  return readTicketCommercialSnapshot({
    version: TICKET_TERMS_VERSION,
    admissionPolicy: "order_together_v1",
    policies: TICKET_POLICIES,
    serviceDate: event.date,
    doorTime: event.doorTime,
    closeTime: event.closeTime,
    descriptionJa: product.descriptionJa,
    descriptionEn: product.descriptionEn,
    salesEndsAt: product.salesEndsAt,
  });
}

/** Do not silently replace corrupt or historical snapshots with current policy. */
export function readTicketCommercialSnapshot(
  value: unknown,
): TicketCommercialSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("ticket_commercial_snapshot_invalid");
  const v = value as Record<string, unknown>;
  const text = (x: unknown, max = 2000): x is string =>
    typeof x === "string" &&
    x.length > 0 &&
    x.length <= max &&
    !/[\u0000-\u001f]/u.test(x);
  if (
    !text(v.version, 40) ||
    !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(v.version) ||
    !text(v.descriptionJa) ||
    !text(v.descriptionEn) ||
    typeof v.serviceDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.serviceDate) ||
    typeof v.doorTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(v.doorTime) ||
    typeof v.closeTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(v.closeTime) ||
    typeof v.salesEndsAt !== "string" ||
    !Number.isFinite(Date.parse(v.salesEndsAt)) ||
    !v.policies ||
    typeof v.policies !== "object"
  )
    throw new Error("ticket_commercial_snapshot_invalid");
  if (!ticketPoliciesForVersion(v.version))
    throw new Error("ticket_commercial_snapshot_invalid");
  if (
    isGroupTicketTermsVersion(v.version) &&
    v.admissionPolicy !== "order_together_v1"
  )
    throw new Error("ticket_commercial_snapshot_invalid");
  if (
    v.version === LEGACY_TICKET_TERMS_VERSION &&
    v.admissionPolicy !== undefined
  )
    throw new Error("ticket_commercial_snapshot_invalid");
  const policies = v.policies as Record<string, { ja: unknown; en: unknown }>;
  for (const key of Object.keys(TICKET_POLICIES))
    if (!policies[key] || !text(policies[key].ja) || !text(policies[key].en))
      throw new Error("ticket_commercial_snapshot_invalid");
  return Object.freeze({
    version: v.version,
    ...(v.admissionPolicy === "order_together_v1"
      ? { admissionPolicy: "order_together_v1" as const }
      : {}),
    policies: Object.freeze(
      Object.fromEntries(
        Object.keys(TICKET_POLICIES).map((key) => [
          key,
          Object.freeze({
            ja: policies[key].ja as string,
            en: policies[key].en as string,
          }),
        ]),
      ) as TicketCommercialSnapshot["policies"],
    ),
    descriptionJa: v.descriptionJa,
    descriptionEn: v.descriptionEn,
    serviceDate: v.serviceDate,
    doorTime: v.doorTime,
    closeTime: v.closeTime,
    salesEndsAt: v.salesEndsAt,
  });
}

export function ticketServiceLabel(
  s: Pick<TicketCommercialSnapshot, "serviceDate" | "doorTime" | "closeTime">,
) {
  return `${s.serviceDate} ${s.doorTime}–${s.closeTime <= s.doorTime ? "翌日 / next day " : ""}${s.closeTime} JST`;
}

export function formatTicketDeadline(value: string) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "—";
  return (
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(instant) + " JST"
  );
}
