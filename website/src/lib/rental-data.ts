/**
 * PURE Osaka venue hire.
 *
 * Provenance, because a venue's own page is the worst place to guess:
 *
 * - `rentalPriceFloor` is the one figure the venue supplied: private hire
 *   starts at ¥200,000. It is a floor, not a quote, and the page says so.
 * - The room inventory below describes what is visible in the venue's own
 *   photographs and what `/qa` already publishes (music, hours, address).
 *   Nothing here states a capacity, a minimum spend, a tax handling or an
 *   inclusion list, because no source for any of those exists yet.
 * - Every enquiry form is written as a subject the venue will discuss, not
 *   as a service it has confirmed it sells. Feasibility and price are
 *   settled in CONTACT, which is where this page sends every open question.
 *
 * Add a figure here only when there is a source to point at.
 */

/** Yen, exclusive of nothing in particular: the venue quotes from here up. */
export const rentalPriceFloor = 200_000;

/** Local, so this module stays readable on its own. Mirrors `vip-data`. */
export const formatYen = (price: number) => `¥${price.toLocaleString("en-US")}`;

export type RentalFact = {
  readonly label: string;
  readonly value: string;
  readonly japanese: string;
};

/** The hero strip: the price and where the room is. */
export const rentalFacts: readonly RentalFact[] = [
  {
    label: "From",
    value: `${formatYen(rentalPriceFloor)}〜`,
    japanese: "貸切料金",
  },
  {
    label: "Where",
    // Not "B1F": the display face draws a one that reads as an I, so the
    // floor is carried by the Japanese line under the value instead.
    value: "Shinsaibashi",
    japanese: "心斎橋筋・地下1階",
  },
] as const;

export type RentalRoomItem = {
  readonly id: string;
  readonly label: string;
  readonly japaneseLabel: string;
  /** One authored line. No inclusions are promised — this describes the room. */
  readonly japanese: string;
};

/** What the floor is, in the order you meet it walking in. */
export const rentalRoom: readonly RentalRoomItem[] = [
  {
    id: "floor",
    label: "The floor",
    japaneseLabel: "フロア",
    japanese:
      "心斎橋筋のダイヤモンドビル地下1階。レンガの壁とミラーボールの下に、まっすぐ抜けるフロアがあります。",
  },
  {
    id: "booth",
    label: "The booth",
    japaneseLabel: "DJブース",
    japanese:
      "HIPHOP・LATIN・REGGAETONを鳴らしてきたブース。持ち込みのDJ・アーティストもご相談ください。",
  },
  {
    id: "light",
    label: "Sound & light",
    japaneseLabel: "音響・照明",
    japanese:
      "フロアに組み込まれたサウンドとムービングライト。演出のご要望は内容に合わせて調整します。",
  },
  {
    id: "bar",
    label: "Bar & staff",
    japaneseLabel: "バー・スタッフ",
    japanese:
      "バーカウンターとフロアスタッフ。ドリンクの構成や当日の進行もあわせてご相談いただけます。",
  },
] as const;

export type RentalUse = {
  readonly id: string;
  readonly label: string;
  readonly japaneseLabel: string;
  readonly japanese: string;
  readonly image: {
    readonly src: string;
    readonly alt: string;
    /** object-position for the card frame. */
    readonly position: string;
  };
};

/**
 * Subjects the venue will discuss — not a catalogue of confirmed services.
 * The copy above this list says so in as many words.
 */
export const rentalUses: readonly RentalUse[] = [
  {
    id: "party",
    label: "Private party",
    japaneseLabel: "貸切パーティー",
    japanese: "誕生日、記念日、チームの打ち上げ。フロアごと、その夜の身内だけに。",
    image: {
      src: "/pure/gallery/party-crowd-032-dsc01629-enhanced-nr.webp",
      alt: "PUREのフロアいっぱいに集まったゲスト",
      position: "50% 46%",
    },
  },
  {
    id: "brand",
    label: "Brand & corporate",
    japaneseLabel: "企業・ブランド",
    japanese: "レセプション、ローンチ、アフターパーティー。サイネージや装飾もご相談ください。",
    image: {
      src: "/pure/gallery/venue-signage-decor-001-004-kur-2900.webp",
      alt: "PUREの店内に掲げられたサイネージと装飾",
      position: "50% 48%",
    },
  },
  {
    id: "live",
    label: "Live & DJ",
    japaneseLabel: "ライブ・DJ",
    japanese: "自主企画、レーベルナイト、ゲストDJ。ブースと音はそのまま使えます。",
    image: {
      src: "/pure/gallery/dj-booth-046-dsc01364.webp",
      alt: "PUREのDJブースでプレイするDJ",
      position: "52% 42%",
    },
  },
  {
    id: "shoot",
    label: "Shoot & filming",
    japaneseLabel: "撮影・収録",
    japanese: "ミュージックビデオ、スチール、配信。日中の時間帯もお問い合わせください。",
    image: {
      src: "/pure/gallery/venue-signage-decor-015-l6a0075.webp",
      alt: "照明に照らされたPURE店内のディテール",
      position: "50% 44%",
    },
  },
] as const;

export type RentalStep = {
  readonly label: string;
  readonly japaneseLabel: string;
  readonly japanese: string;
};

/** Three steps, all of which start in the same place. */
export const rentalSteps: readonly RentalStep[] = [
  {
    label: "Contact",
    japaneseLabel: "ご相談",
    japanese: "ご希望日・ご人数・ご利用内容をお送りください。",
  },
  {
    label: "Quote",
    japaneseLabel: "お見積り",
    japanese: "内容に合わせて、料金と当日の進行をご提案します。",
  },
  {
    label: "The night",
    japaneseLabel: "当日",
    japanese: "その夜、フロアは貸切に切り替わります。",
  },
] as const;

/** Matches an <option> in TheCrossContact exactly, so the form opens ready. */
export const RENTAL_CONTACT_TOPIC = "Venue rental / private event";
