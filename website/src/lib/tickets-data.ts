/**
 * PURE Osaka entry guide.
 *
 * Every value here is either transcribed from the venue's own material inside
 * this repository (address and hours from `/access`, telephone, the printed
 * "PURE OSAKA V.I.P SET MENU" board via `vip-data.ts`) or is a physical fact
 * about the building.
 *
 * There is no admission price in this file on purpose. The venue publishes
 * none of its own, and the figures that circulate on third-party nightlife
 * directories are unverified. When the real figures are confirmed, add them
 * here and nowhere else: the page reads its numbers only from this module.
 */

export const PHONE_NUMBER = "06-6214-6600";
export const PHONE_HREF = "tel:+81662146600";

/** Matches an <option> in TheCrossContact so the form opens ready to send. */
export const CONTACT_TOPIC = "GENERAL ENQUIRY";

export const OPEN_TIME = "22:00";
export const CLOSE_TIME = "05:00";

export type EntryStep = {
  readonly id: string;
  /** The beat, in English. Doubles as the chapter label on the walk rail. */
  readonly label: string;
  readonly japaneseLabel: string;
  /** One line of English, set against the photograph. */
  readonly lead: string;
  /** The Japanese body. Line breaks are authored, never left to the browser. */
  readonly detail: readonly string[];
};

/**
 * The four beats between the street and the floor, in the order a guest
 * actually walks them. The page's signature move hands off one per segment.
 */
export const entrySteps: readonly EntryStep[] = [
  {
    id: "street",
    label: "Street",
    japaneseLabel: "通り",
    lead: "Shinsaibashi-suji, four minutes north.",
    detail: [
      "なんば駅14番出口から徒歩約4分。",
      "ダイヤモンドビルの1階、PUREの看板が目印です。",
    ],
  },
  {
    id: "door",
    label: "Door",
    japaneseLabel: "入口",
    lead: "The sign is the entrance.",
    detail: [
      "看板の下が、そのまま入口です。",
      "スタッフがご案内しますので、そのままお進みください。",
    ],
  },
  {
    id: "reception",
    label: "Reception",
    japaneseLabel: "受付",
    lead: "Photo ID, every night.",
    detail: [
      "入場のお手続きは受付にて承ります。",
      "18歳未満の方はご入場いただけません。",
      "写真付きの身分証を必ずご提示ください。",
    ],
  },
  {
    id: "floor",
    label: "Floor",
    japaneseLabel: "フロア",
    lead: "One flight down.",
    detail: [
      "階段を降りた地下1階がフロアです。",
      "22:00から翌05:00まで、年中無休で開いています。",
    ],
  },
] as const;

export type DoorFact = {
  readonly id: string;
  readonly label: string;
  /** Short enough to stay on one line at every breakpoint. */
  readonly value: string;
  /** True when `value` is a figure rather than a word, for tabular numerals. */
  readonly isNumeric: boolean;
  readonly note: readonly string[];
};

/**
 * The rail a guest checks before leaving the house. `entry-fee` deliberately
 * carries a route to the answer instead of an answer: see the file header.
 */
export const doorFacts: readonly DoorFact[] = [
  {
    id: "hours",
    label: "Hours",
    value: `${OPEN_TIME} / ${CLOSE_TIME}`,
    isNumeric: true,
    note: ["22:00から翌05:00まで。年中無休で営業しています。"],
  },
  {
    id: "age",
    label: "Age & ID",
    value: "20 and over",
    isNumeric: false,
    note: [
      "20歳未満の方はご入場いただけません。",
      "運転免許証・パスポート・マイナンバーカードなど、写真付きの身分証をお持ちください。",
    ],
  },
  {
    id: "entry-fee",
    label: "Entry fee",
    value: "Please ask",
    isNumeric: false,
    note: [
      "入場料金はお電話でご確認いただけます。",
      "VIPテーブルをご利用の場合、入場料金は別途、ご来店人数分をお会計時に頂きます。",
    ],
  },
  {
    id: "floor",
    label: "Floor",
    value: "B1F",
    isNumeric: true,
    note: [
      "大阪府大阪市中央区心斎橋筋2-3-12 ダイヤモンドビル 地下1階。",
      "なんば駅14番出口から徒歩約4分です。",
    ],
  },
] as const;

export const pad = (value: number) => value.toString().padStart(2, "0");
