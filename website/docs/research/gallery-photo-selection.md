# PURE Osaka Gallery Photo Selection

Terraによる `website/image/` の全438イベント写真と関連動画・既存Web素材の精査結果を、`/gallery` 実装へ反映した記録。

## Selection criteria

- 一画面でPURE Osakaのロゴ、会場、照明、来場者の密度が伝わるか。
- 群衆、DJ、パフォーマンス、人物、サイン／会場ディテールの役割が重複しないか。
- 公開ギャラリーとして安全で、露出や身体部位だけを主題にしない構図か。
- 横長featureと縦masonryを交互に置き、暗い写真が連続しないか。
- デスクトップとモバイルの `cover` クロップで、顔、ロゴ、機材が残るか。
- 数MB〜25MB級の原版を直接配信せず、長辺を抑えたWebPへ変換できるか。

## Selected set

| Role | Source | Published asset |
|---|---|---|
| Hero | `image/03_party-crowd/party-crowd-032-dsc01629-enhanced-nr.jpg` | `public/pure/gallery/party-crowd-032-dsc01629-enhanced-nr.webp` |
| Crowd feature | `image/03_party-crowd/party-crowd-007-021-dsc-0432.jpg` | `public/pure/gallery/party-crowd-007-021-dsc-0432.webp` |
| DJ feature | `image/01_dj-booth/dj-booth-037-dsc01262.jpg` | `public/pure/gallery/dj-booth-037-dsc01262.webp` |
| Performance feature | `image/02_performance-dancers/performance-dancers-003-034-dsc-0464.jpg` | `public/pure/gallery/performance-dancers-003-034-dsc-0464.webp` |
| Identity | `image/05_venue-signage-decor/venue-signage-decor-001-004-kur-2900.jpg` | `public/pure/gallery/venue-signage-decor-001-004-kur-2900.webp` |
| DJ portrait | `image/01_dj-booth/dj-booth-099-img-1976.jpg` | `public/pure/gallery/dj-booth-099-img-1976.webp` |
| Guest portrait | `image/04_people-portraits/people-portraits-011-dsc01419.jpg` | `public/pure/gallery/people-portraits-011-dsc01419.webp` |
| Crowd peak | `image/03_party-crowd/party-crowd-017-069-dsc-0552.jpg` | `public/pure/gallery/party-crowd-017-069-dsc-0552.webp` |
| DJ atmosphere | `image/01_dj-booth/dj-booth-088-img-1901.jpg` | `public/pure/gallery/dj-booth-088-img-1901.webp` |
| Neon detail | `image/05_venue-signage-decor/venue-signage-decor-015-l6a0075.jpg` | `public/pure/gallery/venue-signage-decor-015-l6a0075.webp` |
| Guest group | `image/04_people-portraits/people-portraits-103-img-2111.jpg` | `public/pure/gallery/people-portraits-103-img-2111.webp` |
| Venue frame | `image/05_venue-signage-decor/venue-signage-decor-025-dsc01301.jpg` | `public/pure/gallery/venue-signage-decor-025-dsc01301.webp` |
| Guest connection | `image/04_people-portraits/people-portraits-045-img-1677.jpg` | `public/pure/gallery/people-portraits-045-img-1677.webp` |
| Full room | `image/03_party-crowd/party-crowd-008-022-dsc-0436.jpg` | `public/pure/gallery/party-crowd-008-022-dsc-0436.webp` |
| DJ hands | `image/01_dj-booth/dj-booth-046-dsc01364.jpg` | `public/pure/gallery/dj-booth-046-dsc01364.webp` |
| Performance portrait | `image/02_performance-dancers/performance-dancers-047-dsc01490.jpg` | `public/pure/gallery/performance-dancers-047-dsc01490.webp` |
| Guest portrait | `image/04_people-portraits/people-portraits-025-img-1580.jpg` | `public/pure/gallery/people-portraits-025-img-1580.webp` |
| Lounge | `image/04_people-portraits/people-portraits-050-img-1689.jpg` | `public/pure/gallery/people-portraits-050-img-1689.webp` |
| Red detail | `image/05_venue-signage-decor/venue-signage-decor-004-013-dsc-0406.jpg` | `public/pure/gallery/venue-signage-decor-004-013-dsc-0406.webp` |
| Bottle detail | `image/05_venue-signage-decor/venue-signage-decor-028-img-1579.jpg` | `public/pure/gallery/venue-signage-decor-028-img-1579.webp` |
| CTA crowd | `image/03_party-crowd/party-crowd-023-dsc01266.jpg` | `public/pure/gallery/party-crowd-023-dsc01266.webp` |

## Crop and delivery rules

写真ごとのデスクトップ／モバイル `object-position` は `src/lib/gallery-data.ts` に記録する。横写真はモバイルで過度に縦長化せず、縦写真は顔が多い上部3分の1を優先する。21点はffmpeg/libwebpで最大幅2400px、品質82へ変換し、合計約6.3MBに抑えた。Next Imageで表示幅に合わせて再最適化する。

## Exclusions

露出や身体部位に焦点が寄りすぎる近接パフォーマンス写真、同一人物の連写、完全重複のメニュー画像、ClubRaia参照素材、UIモックアップ、未最適化の縦動画は本文から除外した。
