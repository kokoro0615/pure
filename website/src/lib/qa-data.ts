/**
 * PURE Osaka questions.
 *
 * Six entries, and every answer traces to something this repository can
 * evidence: the address and hours behind `/access`, the printed V.I.P board
 * transcribed in `vip-data.ts`, and the venue's own description of the music.
 *
 * Two subjects guests ask about often - dress code and accepted payment
 * methods - are absent by decision. No confirmed source for either exists
 * yet, and a plausible-sounding answer on a venue's own site is worse than
 * no answer. The closing section routes those questions to the telephone
 * instead. Add an entry here only when there is a source to point at.
 */

export type QaEntry = {
  readonly id: string;
  /** The question, as a guest would ask it. */
  readonly question: string;
  /** English label for the index rail. Two words at most. */
  readonly label: string;
  /** Authored paragraphs. Line breaks inside a paragraph are deliberate. */
  readonly answer: readonly string[];
  /** Optional route to the page that carries the detail. */
  readonly link?: { readonly href: string; readonly label: string };
};

export const qaEntries: readonly QaEntry[] = [
  {
    id: "age",
    label: "Age & ID",
    question: "年齢制限はありますか。",
    answer: [
      "18歳未満の方は入場いただけません。",
      "運転免許証・パスポート・マイナンバーカードなど、写真付きの身分証を必ずお持ちください。ご提示いただけない場合は、ご入場をお断りしています。",
    ],
  },
  {
    id: "hours",
    label: "Hours",
    question: "何時から何時まで営業していますか。",
    answer: [
      "22:00から翌05:00まで、年中無休で営業しています。",
    ],
  },
  {
    id: "entry-fee",
    label: "Entry fee",
    question: "入場料金はいくらですか。",
    answer: [
      "入場料金はお電話（06-6214-6600）でご確認いただけます。お問い合わせフォームからもご質問いただけます。",
      "VIPテーブルをご利用の場合、入場料金は別途、ご来店人数分をお会計時に頂きます。",
    ],
    link: { href: "/tickets", label: "入場のご案内" },
  },
  {
    id: "vip",
    label: "VIP tables",
    question: "VIPテーブルは予約できますか。",
    answer: [
      "ご相談を承っています。お席は2時間制で、ご利用時間の30分前にスタッフより延長のご確認をいたします。お会計時にサービス料10%を頂きます。",
      "セットの内容と料金は、VIP Tablesのページに掲載しています。",
    ],
    link: { href: "/vip", label: "VIP Tables" },
  },
  {
    id: "access",
    label: "Getting here",
    question: "どうやって行けばいいですか。",
    answer: [
      "大阪府大阪市中央区心斎橋筋2-3-12、ダイヤモンドビルの地下1階です。",
      "Osaka Metroなんば駅14番出口から、心斎橋筋を北へ徒歩約4分。1階のPUREの看板が目印です。",
    ],
    link: { href: "/access", label: "アクセス" },
  },
  {
    id: "music",
    label: "The music",
    question: "どんな音楽がかかりますか。",
    answer: [
      "HIPHOP、LATIN、REGGAETONを軸にした夜です。",
      "フロアの空気は、ギャラリーの写真でご覧いただけます。",
    ],
    link: { href: "/gallery", label: "ギャラリー" },
  },
] as const;

export const PHONE_NUMBER = "06-6214-6600";
export const PHONE_HREF = "tel:+81662146600";

/** Matches an <option> in TheCrossContact so the form opens ready to send. */
export const CONTACT_TOPIC = "General enquiry";

export const pad = (value: number) => value.toString().padStart(2, "0");
