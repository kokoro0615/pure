/**
 * PURE Osaka V.I.P set menu.
 *
 * Every figure here is transcribed from the venue's printed
 * "PURE OSAKA V.I.P SET MENU / 2HOUR" board. Nothing is estimated or
 * rounded — if a value is not on that board it does not belong in this file.
 */

export type VipImage = {
  readonly src: string;
  readonly alt: string;
  /** object-position above the mobile breakpoint. */
  readonly position: string;
  /** object-position at 760px and below. */
  readonly mobilePosition: string;
};

export type VipSet = {
  readonly id: string;
  /** A / B / C, as printed on the board. */
  readonly rank: string;
  /** Headline pour. */
  readonly name: string;
  /** Bottling or expression under the name. */
  readonly variant: string;
  /** Quantity or mixer line. Empty when the set is a single bottle. */
  readonly serving: string;
  readonly japanese: string;
  /** Yen, tax handling as printed. */
  readonly price: number;
};

export type VipGroup = {
  readonly id: string;
  readonly label: string;
  readonly japaneseLabel: string;
  readonly lead: string;
  readonly image: VipImage;
  readonly sets: readonly VipSet[];
};

export const vipGroups: readonly VipGroup[] = [
  {
    id: "pure-set",
    label: "Pure Set",
    japaneseLabel: "ピュアセット",
    lead: "Champagne arrives lit. The floor turns before the bottle reaches you.",
    image: {
      src: "/pure/vip/table-sparkler.webp",
      alt: "スパークラーを灯したボトルがVIPテーブルへ運ばれる瞬間",
      position: "52% 42%",
      mobilePosition: "54% 38%",
    },
    sets: [
      {
        id: "pure-a",
        rank: "A",
        name: "Veuve Clicquot",
        variant: "Yellow Label",
        serving: "2 bottles",
        japanese: "ヴーヴ・クリコ イエローラベル 2本",
        price: 60000,
      },
      {
        id: "pure-b",
        rank: "B",
        name: "Moët & Chandon",
        variant: "NIR",
        serving: "2 bottles",
        japanese: "モエ・エ・シャンドン NIR 2本",
        price: 70000,
      },
      {
        id: "pure-c",
        rank: "C",
        name: "Dom Pérignon",
        variant: "Vintage Luminous",
        serving: "",
        japanese: "ドン ペリニヨン ヴィンテージ リュミナス",
        price: 90000,
      },
    ],
  },
  {
    id: "bottle-set",
    label: "Bottle Set",
    japaneseLabel: "ボトルセット",
    lead: "Pick the bottle your table drinks all night. Mixers come with it.",
    image: {
      src: "/pure/vip/champagne-call.webp",
      alt: "シャンパンとスパークラーを掲げてテーブルへ向かうPUREのスタッフ",
      position: "44% 34%",
      mobilePosition: "46% 30%",
    },
    sets: [
      {
        id: "bottle-a",
        rank: "A",
        name: "Veuve Clicquot",
        variant: "Yellow Label Brut",
        serving: "",
        japanese: "ヴーヴ・クリコ イエローラベル ブリュット",
        price: 40000,
      },
      {
        id: "bottle-b",
        rank: "B",
        name: "CIROC / Hennessy / Reposado",
        variant: "choice of one",
        serving: "Red Bull × 10",
        japanese: "シロック／ヘネシー／レポサドから1本＋レッドブル10本",
        price: 50000,
      },
      {
        id: "bottle-c",
        rank: "C",
        name: "Clase Azul / Don Julio 1942",
        variant: "choice of one",
        serving: "",
        japanese: "クラセアスール／ドン・フリオ1942から1本",
        price: 80000,
      },
    ],
  },
] as const;

/** Short conditions, printed on the board beside the sets. */
export const vipConditions = [
  { label: "Table time", value: "2 hours", japanese: "2時間制" },
  { label: "Service", value: "10%", japanese: "お会計時に加算" },
  { label: "Entry", value: "Separate", japanese: "入場料金は別途" },
] as const;

/** The five house notes, in the order they appear on the board. */
export const vipNotes = [
  "お席のご利用時間に関しては2時間制になります。",
  "ご着席後、ご利用制限時間の30分前にStaffより延長のご確認をさせて頂きます。",
  "延長がない場合は、ご利用時間が過ぎるとご退席頂きます。",
  "入場料金に関しては、ご来店人数分をお会計時に頂きます。",
  "お会計時にService料10%を頂きます。",
] as const;

export const vipPriceFloor = Math.min(
  ...vipGroups.flatMap((group) => group.sets.map((set) => set.price)),
);

export const vipSetCount = vipGroups.reduce(
  (total, group) => total + group.sets.length,
  0,
);

export const formatYen = (price: number) => `¥${price.toLocaleString("en-US")}`;
