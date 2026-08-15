# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

PURE Osakaへの来店を検討している人、VIP利用を検討している人、店内の熱量や音楽・客層・空間を来店前に確かめたい人。

## Product Purpose

大阪・心斎橋のナイトクラブ PURE Osakaの実際の夜を伝え、来店やVIP相談につなげる公式ウェブ体験。

## Positioning

20年以上続くPURE Osakaの実景、出演者、フロア、来場者、サインやディテールを、提供済みの実写素材によって体験として見せる。

## Operating Context

ユーザーは主に来店前のスマートフォン、またはイベントや店舗を比較中のデスクトップ環境で閲覧する。写真ギャラリーでは、一覧性よりも没入感と「その夜に居る」感覚を優先し、最後に来店・VIP相談へ導く。

## Capabilities and Constraints

- Next.js App Router、React、TypeScript、CSS Modulesで構成する。
- パッケージ管理にはnpmを使う。
- 既存のホーム、メニュー、ABOUT、CONTACT、ACCESSの挙動を維持する。
- GALLERYは独立した `/gallery` ルートとし、MENUのGallery項目から遷移できるようにする。
- モーションは `prefers-reduced-motion` を尊重し、モバイルでも可読性と操作性を損なわない。
- 未確認の価格、イベント日程、出演者名、実績値は作らない。

## Brand Commitments

- 正式名称はPURE Osaka。
- 既存ロゴ、実写素材、深い黒、アイボリー、夜の赤〜マゼンタを核として扱う。
- クラブの熱量を上品に伝え、汎用的なナイトクラブのテンプレート表現に寄せない。

## Evidence on Hand

- `website/public/pure/` に既存のロゴ、メニュー画像、ポスター、最適化済み動画がある。
- `website/image/` に会場、出演者、フロア、来場者、装飾などの大量の実写素材がある。
- `website/src/components/ClubRaiaMenu.tsx` と関連コンポーネントに現在のナビゲーション体験が実装されている。
- お客様の声、価格、個別イベント情報などの検証済みテキスト証拠は現時点で確認されていないため、ギャラリーでは捏造しない。

## Product Principles

- 実際の写真を主役にし、装飾は写真の熱量を引き出すために使う。
- 一目でPURE Osakaと分かる世界観を守る。
- 見る人のペースを尊重しつつ、スクロールに映画的な起伏を持たせる。
- 来店・VIP相談への導線は、鑑賞体験を邪魔せず最後に明確に提示する。
- デスクトップとモバイルの双方で、クロップされる被写体と文字の可読性を守る。

## Accessibility & Inclusion

キーボード操作、十分なコントラスト、代替テキスト、フォーカス表示、`prefers-reduced-motion` を提供する。光の点滅や急激な連続アニメーションは避ける。
