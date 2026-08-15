export type GalleryImage = {
  src: string;
  alt: string;
  caption: string;
  position: string;
  mobilePosition: string;
  /** Intrinsic width / height of the source file. Frames are laid out
   *  from this so photographs are never letterboxed by the grid. */
  ratio: number;
};

const LANDSCAPE_3_2 = 3 / 2;
const LANDSCAPE_4_3 = 4 / 3;
const PORTRAIT_4_5 = 4 / 5;
const PORTRAIT_3_4 = 3 / 4;

/** Measured from the source files in public/pure/gallery. */
const SOURCE_RATIOS: Record<string, number> = {
  "dj-booth-037-dsc01262": LANDSCAPE_4_3,
  "dj-booth-046-dsc01364": PORTRAIT_3_4,
  "dj-booth-088-img-1901": PORTRAIT_4_5,
  "dj-booth-099-img-1976": PORTRAIT_4_5,
  "party-crowd-007-021-dsc-0432": LANDSCAPE_3_2,
  "party-crowd-008-022-dsc-0436": LANDSCAPE_3_2,
  "party-crowd-017-069-dsc-0552": LANDSCAPE_3_2,
  "party-crowd-023-dsc01266": LANDSCAPE_4_3,
  "party-crowd-032-dsc01629-enhanced-nr": LANDSCAPE_4_3,
  "people-portraits-011-dsc01419": PORTRAIT_3_4,
  "people-portraits-025-img-1580": PORTRAIT_4_5,
  "people-portraits-045-img-1677": PORTRAIT_4_5,
  "people-portraits-050-img-1689": PORTRAIT_4_5,
  "people-portraits-103-img-2111": PORTRAIT_4_5,
  "performance-dancers-003-034-dsc-0464": LANDSCAPE_3_2,
  "performance-dancers-047-dsc01490": PORTRAIT_3_4,
  "venue-signage-decor-001-004-kur-2900": LANDSCAPE_3_2,
  "venue-signage-decor-004-013-dsc-0406": LANDSCAPE_3_2,
  "venue-signage-decor-015-l6a0075": PORTRAIT_4_5,
  "venue-signage-decor-025-dsc01301": PORTRAIT_3_4,
  "venue-signage-decor-028-img-1579": PORTRAIT_4_5,
};

const galleryImage = (
  file: string,
  alt: string,
  caption: string,
  position: string,
  mobilePosition: string,
): GalleryImage => ({
  src: `/pure/gallery/${file}.webp`,
  alt,
  caption,
  position,
  mobilePosition,
  ratio: SOURCE_RATIOS[file] ?? LANDSCAPE_3_2,
});

export const galleryHero = galleryImage(
  "party-crowd-032-dsc01629-enhanced-nr",
  "青紫の照明の下で集まる来場者",
  "The floor",
  "50% 50%",
  "53% 44%",
);

export const galleryStack = [
  galleryImage(
    "party-crowd-007-021-dsc-0432",
    "照明に包まれたダンスフロア",
    "Crowd",
    "50% 50%",
    "50% 44%",
  ),
  galleryImage(
    "dj-booth-037-dsc01262",
    "DJブースで機材を操作するDJ",
    "Sound",
    "49% 48%",
    "53% 40%",
  ),
  galleryImage(
    "performance-dancers-003-034-dsc-0464",
    "フロアでパフォーマンスする人物と来場者",
    "Movement",
    "51% 48%",
    "52% 40%",
  ),
] as const;

export const galleryAccordions = [
  galleryImage(
    "venue-signage-decor-001-004-kur-2900",
    "紫色に発光するPURE 20のサイン",
    "Identity",
    "50% 48%",
    "50% 42%",
  ),
  galleryImage(
    "dj-booth-099-img-1976",
    "PURE 20のサイン前に立つDJ",
    "Booth",
    "50% 43%",
    "50% 32%",
  ),
  galleryImage(
    "people-portraits-011-dsc01419",
    "テーブルを囲む来場者",
    "Together",
    "50% 45%",
    "50% 33%",
  ),
  galleryImage(
    "party-crowd-017-069-dsc-0552",
    "DJブース前に集まる来場者",
    "Energy",
    "50% 51%",
    "48% 43%",
  ),
] as const;

export const galleryGrid = [
  galleryImage(
    "dj-booth-088-img-1901",
    "青紫の照明に照らされたDJブース",
    "Blue hour",
    "48% 48%",
    "49% 38%",
  ),
  galleryImage(
    "venue-signage-decor-015-l6a0075",
    "煉瓦壁に設置されたPUREのネオンサイン",
    "PURE neon",
    "50% 50%",
    "50% 45%",
  ),
  galleryImage(
    "people-portraits-103-img-2111",
    "フロアでポーズを取る来場者",
    "Faces",
    "50% 44%",
    "50% 31%",
  ),
  galleryImage(
    "venue-signage-decor-025-dsc01301",
    "会場内の発光するフレーム装飾",
    "Night detail",
    "50% 48%",
    "52% 38%",
  ),
  galleryImage(
    "people-portraits-045-img-1677",
    "クラブ内で集まる来場者",
    "Connection",
    "51% 44%",
    "52% 33%",
  ),
  galleryImage(
    "party-crowd-008-022-dsc-0436",
    "上方から捉えた賑わうダンスフロア",
    "Full room",
    "50% 50%",
    "50% 43%",
  ),
] as const;

export const galleryReel = [
  galleryImage(
    "dj-booth-046-dsc01364",
    "DJ機材を操作する手元",
    "Hands on sound",
    "50% 51%",
    "50% 48%",
  ),
  galleryImage(
    "performance-dancers-047-dsc01490",
    "照明の下でパフォーマンスする人物",
    "Performance",
    "49% 47%",
    "49% 34%",
  ),
  galleryImage(
    "people-portraits-025-img-1580",
    "煉瓦壁の前に座る来場者",
    "Portrait",
    "50% 43%",
    "50% 30%",
  ),
  galleryImage(
    "people-portraits-050-img-1689",
    "ソファ席で過ごす来場者",
    "Lounge",
    "50% 46%",
    "51% 35%",
  ),
  galleryImage(
    "venue-signage-decor-004-013-dsc-0406",
    "赤い照明に照らされた会場装飾",
    "Red room",
    "50% 50%",
    "50% 45%",
  ),
  galleryImage(
    "venue-signage-decor-028-img-1579",
    "赤く照らされたボトル棚",
    "Afterglow",
    "50% 48%",
    "50% 38%",
  ),
] as const;

export const galleryCta = galleryImage(
  "party-crowd-023-dsc01266",
  "DJブース前に集まる来場者と照明",
  "Meet us after dark",
  "49% 49%",
  "51% 42%",
);
