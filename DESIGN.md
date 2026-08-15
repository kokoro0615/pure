---
name: PURE Osaka
description: Night Pulse - 実写の重なりで大阪の夜を体験へ変える視覚世界
colors:
  carbon-black: "#0b0a10"
  ink-1: "#14131b"
  ink-2: "#1c1b25"
  bone-white: "#f6f1e7"
  muted-bone: "rgb(246 241 231 / 64%)"
  optical-line: "rgb(246 241 231 / 14%)"
  club-magenta: "#e8467f"
  club-magenta-deep: "#d42966"
typography:
  display:
    fontFamily: '"Migra", var(--font-playfair), Georgia, serif'
    fontSize: "clamp(4rem, 8.2vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.8
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Migra", var(--font-playfair), Georgia, serif'
    fontSize: "clamp(3rem, 6vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.89
    letterSpacing: "-0.035em"
  body:
    fontFamily: 'var(--font-open-sans), "Open Sans", sans-serif'
    fontSize: "clamp(11px, 0.9vw, 14px)"
    fontWeight: 400
    lineHeight: 2
    letterSpacing: "0.08em"
  control:
    fontFamily: 'var(--font-meta)'
    fontSize: "clamp(12px, 0.98vw, 14.5px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.17em"
  label:
    fontFamily: 'var(--font-open-sans), "Open Sans", sans-serif'
    fontSize: "8px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  square: "0px"
  pill: "999px"
  circle: "50%"
spacing:
  micro: "8px"
  control-gap: "10px"
  mobile-edge: "16px"
  page-edge: "clamp(20px, 5vw, 80px)"
components:
  navigation-link:
    textColor: "{colors.bone-white}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    padding: "0 1px"
    height: "44px"
  social-control:
    textColor: "{colors.bone-white}"
    borderColor: "{colors.optical-line}"
    rounded: "{rounded.circle}"
    size: "44px"
    iconSize: "21px"
  media-card:
    backgroundColor: "#11131a"
    textColor: "{colors.bone-white}"
    rounded: "{rounded.square}"
    width: "100%"
    height: "100%"
  cta-primary:
    backgroundColor: "{colors.bone-white}"
    textColor: "{colors.carbon-black}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 clamp(22px, 1.9vw, 28px) 0 clamp(26px, 2.2vw, 34px)"
  cta-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.bone-white}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    height: "44px"
    rule: "1px {colors.bone-white} at 40%, full on hover"
  circular-control:
    textColor: "{colors.bone-white}"
    rounded: "{rounded.circle}"
    size: "52px"
---

# Design System: PURE Osaka

## Overview

**Creative North Star: "Night Pulse"**

Night Pulse は、夜を受動的なサムネイル一覧ではなく、記憶の中で重なる脈動として扱う。カーボンブラックの暗部、骨のような白、クラブ・マゼンタ、フルブリードの実写、映画的なクロップ、細い光学線が、写真の熱量を抑え込まず上品に編成する。

体験の語りは静かな入場から始まり、人、音、光へと近づき、最後に来店またはVIP相談へ転換する。最初のビューポートでは、画面の軸を外した全高の群衆写真、二行のタイトル、その行内で生きる写真インセット、唯一のスクロール合図を重ねる。この構成は `/gallery` の物語表現であり、他ルートの固定テンプレートではない。

**Key Characteristics:**

- 実写を主役にする暗い映画的な舞台
- Migraの大きな編集的見出しとOpen Sansの精密な情報層
- 角の立った写真面、円形コントロール、ピル形CTAの対比
- スクロールと重なりで生まれる脈動、細い線で整える操作性
- 鑑賞の最後だけに現れる来店とVIP相談の二つの明確な行動

## Colors

主役は Carbon Black と Bone White の高コントラストで、Club Magenta はスクロールバーなど小さな信号に限定する。写真自身の青紫、赤、マゼンタを色面の代わりに使う。

すべての値は `globals.css` の `:root` に一度だけ定義する。ページ側の `.page` ブロックで再定義しない（2026-08-10 の是正前は5モジュールが各自で定義しており、near-black 6種・bone white 3種・アクセント5系統に分裂していた）。

### Primary

アクセントは**サイト全体で1系統**。同じ色相を2値持つ。

- **Club Magenta** (`--accent` / `#e8467f`): 文字と数字を載せられる明度。`--ink-0` に対し実測5.5:1。
- **Club Magenta Deep** (`--accent-deep` / `#d42966`): ブランド値。`--ink-0` に対し4.1:1で文字には使えないため、罫線・塗り・グラデーションに限る。

ページごとにアクセントを変えない。部屋ごとの色（VIPの金、通路の紫）は**写真そのものの光**が担う（The Photograph Carries Color Rule）。

### Neutral

- **Carbon Black** (`--ink-0` / `#0b0a10`): 全ルートの基底背景。
- **Ink 1 / Ink 2** (`#14131b` / `#1c1b25`): 面を値で分ける段。半透明パネルの積層で深度を作らない。
- **Bone White** (`--bone` / `#f6f1e7`): 見出し、主要ラベル、フォーカス輪郭、主要CTAの面。
- **Muted Bone** (`--bone-soft` / 64%): 補助説明と低い情報階層。
- **Optical Line** (`--edge` / 14%, `--edge-strong` / 40%): 境界、操作の輪郭、微細な区切り。

### Named Rules

**The Rare Magenta Rule.** Club Magentaは方向を知らせる信号であり、写真と競う背景色にはしない。

**The Photograph Carries Color Rule.** 大きな色彩は実写素材から得て、UIの彩度は抑える。

## Typography

**Display Font:** Migra（Playfair Display、Georgiaの順にフォールバック）

**Body Font:** Open Sans（sans-serifへフォールバック）

**Character:** Migraは低い行高と負の字間で夜の見出しを一枚の像として見せる。Open Sansは小さく広い字間を持ち、写真上のキャプション、ナビゲーション、操作ラベルを光学的に整える。

### Hierarchy

- **Display**（400、`clamp(4rem, 8.2vw, 6rem)`、行高`0.8`、字間`-0.035em`）: Heroと最終CTAの大見出し。英字は大文字で短く保つ。
- **Headline**（400、`clamp(3rem, 6vw, 6rem)`、行高`0.89`、字間`-0.035em`）: 各章の見出し。改行は物語の拍として使う。
- **Statement**（400、`clamp(2.5rem, 5.8vw, 5.6rem)`、行高`1.18`、字間`-0.03em`）: 日本語マニフェストの一度きりの大きな文章。
- **Body**（400、`clamp(11px, 0.9vw, 14px)`、行高`2`、字間`0.08em`）: 説明文。写真上でも呼吸できる疎な行間を維持する。
- **Label**（400、`8px`、字間`0.18em`、大文字）: 写真キャプション、通し番号、フッター。CTAは同系統を`10px`・600で強め、ナビゲーションは`clamp(10px, 0.78vw, 12px)`・500・字間`0.19em`を使う。

### Named Rules

**The Two-Voice Rule.** Migraは感情と章立て、Open Sansは情報と操作に限定し、役割を交換しない。

**The Short Display Rule.** 大見出しは広く短く組み、説明文を大見出しのサイズへ昇格させない。

## Layout

ギャラリーはブラウザ本文ではなく、画面全体に固定された独自スクロールルートとして動く。背景は全幅、ナビゲーションは固定レイヤー、本文は100vh/100dvhのHeroから、マニフェスト、sticky card stack、横方向のaccordion、12列dense grid、scroll-snap reel、全高CTAへ進む。この順序は「静かに入る→人・音・光を通る→来店に変える」という `/gallery` 固有の物語であり、サイト全体の普遍レイアウトではない。

デスクトップHeroの写真は左22%を空けて配置し、タイトルは左`clamp(20px, 5vw, 80px)`から中央を横切る。主要な横余白は `clamp(20px, 5vw, 80px)`、章間の縦余白はおおむね`120px`から`250px`へ流動する。stackは`0.72fr / 1.28fr`、dense gridは12列で`7/5`、`4/8`、`5/7`の不均衡な対をつくる。reelは通常`38vw`、偶数項を`52vw`にして高さと開始位置もずらす。

`900px`以下でHero写真は全面化し、stack比率を調整する。`760px`以下では本文余白を`16px`に寄せ、stackを単列化し、accordionとreelを`78vw`の横スナップへ変え、dense gridを単列の`4:5`中心（選択項目は`4:3`）へ変換する。ナビゲーションは`812px`以下で右上の二段構成となり、ソーシャルラベルと区切り線を外す。safe-area insetを常に優先する。

**The Asymmetric Pulse Rule.** 等幅の反復ではなく、写真の幅、縦位置、stickyの重なりを変えてリズムをつくる。ただし主要被写体と文字の可読性を犠牲にしない。

## Elevation & Depth

深度は影の多用ではなく、写真の明度・彩度フィルター、暗いグラデーションwash、固定grain、sticky面の重なり、背景のわずかな色差でつくる。通常の写真面はフラットで、stack cardだけが`0 32px 90px rgb(0 0 0 / 42%)`の大きく柔らかな影を持つ。二次CTAは`inset 0 0 0 1px rgb(245 239 230 / 42%)`で暗い面を輪郭化する。lightboxは`rgb(4 5 8 / 96%)`の暗幕と`blur(18px)`で元の画面から分離する。

固定grainは`/the-cross/static-noise.gif`を`0.055`の不透明度と`soft-light`で重ね、モバイルでは`0.04`へ下げる。Hero、media、accordion、CTAの写真にはそれぞれ異なるbrightness/saturate/contrastを与え、hover時だけ現像が少し開く。

### Named Rules

**The Shadow Has Weight Rule.** 影はsticky stackの物理的な重なりにだけ使い、すべての写真を浮遊カードにしない。

**The Darkroom Layer Rule.** 深度は黒の段差、写真の現像、薄いwash、grainでつくり、汎用的なガラスカードへ置き換えない。

## Shapes

写真カード、accordion、grid、lightbox stageは角丸のない矩形（`0px`）で、クロップの緊張感を保つ。矢印、拡大、ソーシャル、lightboxの操作は正円（`50%`）に統一し、Heroの行内写真と二つのCTAだけを完全なピル（`999px`）にする。この三種の輪郭以外は増やさない。

境界は原則1pxの細い光学線で、面を囲うより操作可能性と区切りを示す。アイコンは塗りつぶしではなく、`1.25`の丸端ストロークを使う。

**The Three-Silhouette Rule.** 鋭い写真面、円形操作、ピル形の行動導線だけで形の語彙を構成する。

## Components

### Navigation

固定ナビゲーションはBone White系のOpen Sans大文字ラベルで、各リンクに44px以上の操作高を持たせる。hoverは下辺の1px線が右から左へ伸び、focus-visibleは2pxの明色アウトラインと4pxのオフセットで示す。ソーシャル操作は36pxの正円で、hover時に明暗を反転する。メニュー遷移時はリンク群が上へ30px退き、Closeラベル・線・アイコンが順番に入る。モバイルは`812px`以下で右上へ圧縮する。

### Media Cards

写真面全体をbuttonにし、角のないFrame Charcoalを読み込み中の下地にする。通常は写真を`scale(1.02)`、`saturate(0.88) contrast(1.06) brightness(0.88)`で抑え、hover/focusで`scale(1.065)`と明るい現像へ移る。下端には暗いwash、8pxのOpen Sansキャプションと二桁番号を置く。右上の42px円形拡大アイコンは通常非表示で、hover/focus時にBone Whiteへ反転して現れる。すべての写真カードはlightboxを開く。

### Accordion Panels

デスクトップでは四枚が同じ高さを共有し、hover/focusされた面だけflex-growを`2.7`へ拡張する。休止時の写真は暗く低彩度、展開時は`900ms cubic-bezier(0.16, 1, 0.3, 1)`で元の比率と彩度へ戻る。モバイルではhover依存を外し、各面を`78vw`のscroll-snap項目にする。

### Reel Controls

前後操作は52pxの円、1pxのOptical Line、19pxの線画矢印で構成する。hover時はBone Whiteの面とCarbon Blackの矢印に反転し、`scale(0.96)`でわずかに沈む。reel本体はscroll-snapを使い、ボタンはビューポート幅の72%または760pxの小さい方だけ滑らかに送る。

### Dual CTA

`Plan your visit`は暗い半透明面に明るい1pxの内側線を持つ二次ピル、`VIP & Contact`はBone White面とCarbon Black文字を持つ一次ピルである。双方は最小高62px、左28px・他辺7pxのpadding、10px・600・字間0.18emのOpen Sans大文字ラベルを共有し、右端に48pxの暗い円形矢印を内包する。hoverは全体を`scale(0.98)`、矢印を右上へ2px移動し`scale(1.04)`する。モバイルでは縦積みにする。

### Lightbox

lightboxは全画面dialogで、写真を`object-fit: contain`する最大`82vw × 78vh`のstage、Close、循環する前後矢印、キャプションと`NN / 21`表示を持つ。開いたらCloseへフォーカスし、Escape、左右矢印、Tabのフォーカストラップに対応する。背面のページとナビゲーションは`inert`になり、スクロールも停止する。閉じた後は起点カードへフォーカスを戻す。モバイルでは前後操作を下端へ移し、キャプションを中央化する。

### Motion System

GSAPの導入timelineはHero写真を2.2秒で暗い`scale(1.13)`から開き、語を1.25秒・0.12秒staggerで下から入れ、説明とscroll cueを0.9秒地点から1秒で立ち上げる。ScrollTriggerは独自page scrollerを参照し、マニフェストの文字をscrub `1`、stack cardをscrub `0.8`、対象写真のparallaxをscrub `1`で進める。hover系の主要easeは`cubic-bezier(0.16, 1, 0.3, 1)`、ナビゲーションは`cubic-bezier(0.65, 0, 0.35, 1)`を使う。

`prefers-reduced-motion: reduce`ではGSAPを生成しない。scroll cueの反復を停止し、写真、accordion、CTA、lightbox、ナビゲーションのtransition/animationを1msへ短縮し、遅延を除く。コンテンツや操作は省略しない。

### Gallery Media Policy (`/gallery` only)

Terraの選定は、群衆、DJ、パフォーマンス、人物、サイン／会場ディテールの役割が重複せず、PURE Osakaのロゴ、会場、照明、来場者密度が一画面で伝わることを優先した。438点から選ばれた21点は、暗い写真の連続を避け、横長featureと縦方向のリズムを交互にする。この選択と順序はギャラリールート固有であり、他の画面に同じ構成を要求しない。

各画像はデスクトップ用とモバイル用の`object-position`をデータに保持し、`760px`以下で切り替える。`cover`後も顔、ロゴ、DJ機材を残し、横写真をモバイルで過度に縦長化せず、縦写真では顔が多い上部三分の一を優先する。露出や身体部位だけに焦点が寄る近接写真、同一人物の連写、完全重複、ClubRaia参照素材、UIモックアップ、未最適化の縦動画は本文から除外する。

原版は直接配信せず、21点をffmpeg/libwebpで最大幅2400px・品質82のWebPへ変換し、合計約6.3MBに抑える。配信時はNext Imageの`sizes`とレスポンシブ最適化を維持する。

## Do's and Don'ts

### Do

- Do 実在するPURE Osakaの写真を最大の色面として使い、UIは写真の読みやすさを支える。
- Do Migraを短い見出し、Open Sansを情報と操作に使い分ける。
- Do デスクトップとモバイルの両方で、顔、ロゴ、機材が残る`object-position`を画像ごとに確認する。
- Do キーボードフォーカス、lightboxのフォーカス復帰、`prefers-reduced-motion`を保持する。
- Do 来店とVIP相談の二つのCTAを鑑賞体験の最後に同じ重要度の操作品質で示す。

### Don't

- Don't 写真を均等な小型サムネイルの受動的アーカイブへ戻す。
- Don't Club Magentaを大面積に塗り、実写の赤・青紫・マゼンタと競合させる。
- Don't すべての面へ角丸、影、ガラス効果を加える。
- Don't `/gallery` 固有のstack、accordion、dense gridの順序を、全ルートの必須テンプレートとして扱う。
- Don't 未確認の価格、イベント、出演者、実績、または安全性を欠く写真を追加する。

---

## 2026-08-10 — `/gallery` 再構築（Contact sheet at 3AM）

崩壊の実測原因と、その修正で確定した設計判断の記録。上のフロントマターは初版
（Night Pulse）の値であり、`/gallery` については以下が現行の正。

### 実測した崩壊原因

| # | 症状 | 原因 |
|---|------|------|
| 1 | 全カード・全グリッド画像の上端に約25pxの帯 | `.parallaxMedia` がCSSに未定義。`styles.parallaxMedia` が `undefined` となり、class属性に文字列 `"undefined"` が出力されていた。GSAPは `.undefined` を掴んで動作していたが、視差量 ±5% に対し `scale(1.02)` しかオーバースキャンが無く、背景が露出 |
| 2 | 見出しの上下が切れる | `.heroLine { overflow: hidden }` + `line-height: 0.8`。clientH 77px に対し scrollH 91px |
| 3 | 日本語がすべてゴシック体にフォールバック | Migra / Playfair にCJKグリフが無い |
| 4 | 日本語の行が極端に短く折れる | `max-width` に `ch` を使用。`ch` は継承したラテン欧文の "0" 幅で解決されるため、CJKでは約半分の測度になる |
| 5 | dense grid が 2.3:1 のレターボックスに | `grid-auto-rows` + row span で高さを決めており、写真の実比率（3:2 / 4:3 / 4:5 / 3:4）を無視 |
| 6 | sticky カードが生の重なり（特にモバイル） | オフセット22pxのみで、後続カードとの階層表現が無い |
| 7 | 固定ナビが明るい写真に直接重なり判読不能 | ギャラリー側にスクリムが無く、共通ヘッダーの30%グラデーションだけでは不足 |
| 8 | ピン留めセクションが722pxずれる（再構築中に発生） | `content-visibility: auto` によりレンダリング前後で高さが変わり、ScrollTriggerの start が陳腐化 |
| 9 | デッキの前面カードが真っ黒（再構築中に発生） | `filter` を `none` から補間させたため。GSAPが開始値を推定できない |

### 確定した設計判断

- **統括概念**: 一晩のフィルム1本。左ガター上を走る髪の毛線（spine）とスクロール
  位置を示すマゼンタのティックが、全セクション共通の整列軸になる。
- **署名モーション（1ページ1つ）**: `.strip` のピン留め横パン。他のセクションは静かに保つ。
- **セクション構成**: hero → manifesto → deck(sticky) → mosaic(3列不等幅) →
  strip(pinned pan) → cta。旧 accordion と dense grid は「等分セル」の重複だったため
  mosaic に統合し、1セクション分の尺を削減。
- **写真の比率はデータが持つ**: `gallery-data.ts` の `ratio` は実ファイル実測値。
  レイアウトは比率に従う（トリミングでレイアウトに合わせない）。
- **和文組み**: 表示用に Shippori Mincho（`next/font`, `preload: false`）。
  行長は `em`（＝文字数）で指定し、`ch` は欧文見出しにのみ使う。
- **スクロール量の指標**: 明滅ではなく `transform` のみ。デッキの後退表現は
  `filter: brightness()` ではなく `opacity` + `scale`（コンポジタのみで完結）。
- **ScrollTrigger と併用しないもの**: `content-visibility: auto`（高さが動くため）。
  代わりに `ResizeObserver` + `document.fonts.ready` で `refresh()` する。

### Don't（追記）

- Don't CSSに存在しないクラス名を `styles.x` で参照する（`"undefined"` がDOMに出る）。
- Don't 和文の `max-width` を `ch` で指定する。
- Don't `filter` をスクロール連動で補間する。
- Don't 写真の実比率を無視して行高でグリッドを組む。

---

## 2026-08-10 — `/vip` 新設（VIP Tables / The bottle reaches your table）

MENU の `VIP Tables` はこれまで CONTACT オーバーレイを開くだけだった。実在の
「PURE OSAKA V.I.P SET MENU / 2HOUR」ボードを情報源として独立ルート `/vip` を
新設し、MENU からの遷移先をそこへ付け替えた。

### Design Read

`来店前に席を決める人` 向けの価格ページを、`nocturnal luxury` の語法で、
`editorial（黒い紙面に金の箔押し／高級ワインリストの組版）` に寄せて読む。
方向は1つに絞り、カードグリッド化は禁じ手として最初から外した。

### 統括概念とセクション

**統括概念**: 「The bottle reaches your table」。スパークラーを灯したボトルが
フロアを横切って席へ届く一瞬を、ページ全体の光の軌跡として組む。左ガターの
髪の毛線（spine）は `/gallery` から継承する共通の整列軸で、`/vip` ではその上を
シャンパンゴールドの火花が下る。

**署名モーション（1ページ1つ）**: 「光が価格に届く」の三段。
spine を火花が下る（scrub, `transform` のみ）→ 各行の1px罫線が左から引かれる
（`scaleX`）→ 数字に箔（foil）が一度だけ走る。`.isLit` は GSAP からしか付かない
ので、reduced-motion と JS 不達時は価格が単色のシャンパンゴールドで出る。

**セクション**: hero → ledger（PURE SET / BOTTLE SET の左右反転スプレッド ＋
conditions strip）→ house rules（写真を上へ食い込ませた非対称）→ CTA。
4セクションのみ。`/gallery` の deck / mosaic / pinned strip は持ち込まない。

### 確定した設計判断

- **価格表はカードにしない**。`ul > li` の行組み（rank / name / variant / 和文 /
  価格）で、ワインリストの語法に寄せる。行は情報であって遷移先ではないため
  フォーカス可能にせず、hover 応答は `@media (hover: hover)` に閉じる。
- **アクセントは金1色**。`/vip` では Club Magenta を使わない（写真が持つ赤と
  マゼンタと競合するため）。`--gold: oklch(0.845 0.088 82)`、`--gold-deep:
  oklch(0.705 0.108 74)`。面積は rank・価格・罫線・火花・フォーカス輪郭のみ。
- **`--bone-faint` は 50%**。32% では ink-0 に対して実測 2.6:1 で AA を割る。
  50% で 4.9:1、`--bone-soft`(64%, 7.4:1) との階層も保てる。
- **箔は `background-clip: text`**。`@supports` で囲い、非対応・reduced-motion・
  `.isLit` 未付与時は `color: var(--gold)` の単色に落ちる（文字が消えない）。
- **和文の改行は原稿側で決める**。`<br />` を作字し、`word-break: auto-phrase`
  は対応ブラウザのみの上積みとして `@supports` で足す。measure は `em`。
- **ヒーローはアートディレクション（サイズ違いではなく別トリミング）で出す**。
  被写体のVIPボードは縦位置の中央（原寸 y 25%–70%）にあり、3:4 の原版を
  16:10 のヒーローに `cover` すると高さの約53%が捨てられ、ボードが半分に
  切れる。`object-position` の X は横方向のはみ出しが 0 のため効かず、Y で
  逃がすと今度は見出しと看板の "VIP" が衝突する。
  → 横位置クロップ（原版 y 1363–4477 を切り出した 2560×1706）を
  `≥901px かつ アスペクト比 ≥1:1` に、原版の縦位置を電話に出す。
  `next/image` はブレークポイントごとにファイルを差し替えられないため
  ここだけ `<picture>` + `srcSet` を使う（LCP画像なので二重DLは許容しない）。
- **見出しは看板の文字に届かない幅で止める**。デスクトップは `10.4vw / max
  9.4rem`、電話は `17.4vw / max 6rem`。電話ではヒーローを
  `grid-template-rows: auto auto 1fr` にして見出しを上に寄せ、看板の "VIP" の
  上で完結させる。
- **skip link は nav の下に置く**。共通ヘッダーは `.page` の兄弟で `z-index: 99`
  なので、`.page` 内の要素はどれだけ z-index を上げても上に出られない。
- **スプレッドの sticky**: グリッドアイテム自身を `position: sticky` +
  `align-self: start` にする（グリッドエリアが包含ブロックになる）。
- **視差はフレーム内の写真に**。`.spreadImage` に `scale(1.09)` のオーバースキャン
  を CSS で持たせ、GSAP は `yPercent ±3.4` と `scale` を同時に書く
  （`/gallery` の帯バグの再発防止）。

### 事実の扱い

`vip-data.ts` の金額・本数・銘柄・注意書きは、すべて現物ボードの転記のみ。
推定・丸め・補完はしない。ボードに無い値はファイルに入れない。

### Don't（追記）

- Don't `/vip` に Club Magenta を面で入れる。
- Don't 価格表を等分カードグリッドへ戻す。
- Don't 和文を `ch` で measure する（既出）。
- Don't `.page` 内の要素で共通ヘッダーより上に描こうとする。

---

## 2026-08-10 — MENU 再構成（SYSTEMS→TICKETS / LINEUP・EVENTS 削除 / Q&A 追加）

MENU の項目を 6 → 5 に組み替えた。枠が1つ減ったことで旧レイアウトが破綻するため、
グリッド・モーション・写真をまとめて作り直した記録。

### 実測した崩壊原因（枠が1つ減ると何が壊れたか）

| # | 症状 | 原因 |
|---|------|------|
| 1 | 2行目の右端に4カラム分の空白が空く | 旧CSSは `nth-child` に固定span（5/3/4 + 3/5/4）を直書きしており、12カラム×2行がちょうど6枠で埋まる前提だった。5枠では2行目が 3+5=8 で 4 カラム余る |
| 2 | `06 destinations` が実数と食い違う | 件数が文字列でハードコードされていた |
| 3 | `#events` `#lineup` `#system` はいずれもリンク切れ | ホームに対応するセクションが存在しない。削除対象2件とTICKETSの前身がすべて死にリンクだった |
| 4 | 開閉が体感で遅い | パネル本体 `opacity .7s ease .3s`、ヘッダーの CLOSE が `transition-delay: 1s`〜`1.2s`。MENUを押してから操作可能に見えるまで約1.3秒 |
| 5 | パネルを開くと CLOSE と `Follow` ラベルが重なる | `.socialLink` だけが退避し、`.socialLabel` と `.socialLinks` の左罫線が残っていた |
| 6 | 明るい写真の上で 9–10px の文字が AA を割る | ACCESS（白い建物）で `detail` 実測 3.85:1。スクリムが `0.92 → 0.04 / 62%` の2点補間で、コピー帯の高さでは約0.37までしか効いていない |
| 7 | メニューの写真2点が PURE Osaka の実景でない | `system.webp`（リストバンド）と `gallery-night-v2.webp`（青いレーザーのクラブ）は寒色のストック調で、実写ライブラリ445点のどれとも一致しない。PURE の実景は暖色のタングステン＋レンガ＋ネオン |

### 確定した設計判断

- **統括概念**: 「五つの扉」。均等なカードを5枚並べず、1枚を支配的なフレームにして
  残り4枚を不等幅で掛ける。行1の継ぎ目はcol 8、行2はcol 5とcol 10に置き、
  上下の継ぎ目を意図的に一致させない。整列軸は左ガターのspine（`/gallery`・`/vip` と共通）。
- **署名モーション（1つだけ）**: 「見ている扉の周りで部屋が暗くなる」。
  `.dim` の `opacity` のみで実装（コンポジタ完結）。`:hover` は
  `(hover: hover) and (pointer: fine)` に閉じ、`:focus-within` でキーボードにも同じ体験を出す。
- **`filter` は焼き込み、動かさない**。露出の変化は `.tint` の opacity で表現する
  （`/gallery` で `filter` をスクロール補間して黒落ちした件の再発防止）。
- **順序は階層**。公開済みの GALLERY / VIP / ACCESS が 01–03 と大きい面積を取り、
  未公開の TICKETS / Q&A が 04–05 で列を締める。番号はDOM順＝視覚順。
- **未公開項目はリンクにしない**。`href: null` の項目は `<div>` で描画し、
  タブ順に入れず、`Opening soon` のチップを出す。死にリンクを増やさない。
  チップは自前の地（`rgb(6 7 11 / 76%)`）を持ち、写真の明るさに左右されない。
- **スクリムは3点補間**。`0.94 → 0.82 (26%) → 0.04 (70%)` とし、上端にも 52%→32% を敷く。
  最も明るい画素に対する実測で、静止時・hover時ともに全テキストが
  4.79:1 以上（大見出しは 7:1 以上）。写真ごとの `object-position` は
  フレーム比率に合わせて個別に持つ。
- **開閉の尺**: パネル 420ms / タイル 720ms（0.32s + index×0.06s）/ CLOSE 340ms。
  最後のタイルが着地するまで約1.28秒 → 約0.76秒に短縮。
- **写真は実景のみ**。`website/image/` の445点から選定：
  GALLERY = `party-crowd-032-dsc01629-enhanced-nr`（PUREサイン入りのフロア全景）、
  TICKETS = `venue-signage-decor-001-004-kur-2900`（入口通路のPURE 20ネオン）、
  Q&A = `venue-signage-decor-004-013-dsc-0406`（贈札が並ぶ通路＝掲示の壁）。
  不使用になった `events / lineup / system / gallery / gallery-night-v2` は削除。

### Don't（追記）

- Don't メニュー項目の span を `nth-child` に直書きして枚数固定の前提を作る。
- Don't 遷移先が無い項目を `<a href="#...">` で置く。
- Don't 写真の上の小さな文字を、スクリムの実測なしにアルファだけで決める。
- Don't PURE Osaka の実景でない素材をメニューの面に使う。

---

## 2026-08-10 — `/tickets`・`/qa` 新設（MENU の未公開2枠を実装）

MENU の `Tickets` と `Q&A` は `href: null` の「Opening soon」タイルだった。
実ルートを2本新設し、MENU の遷移先を付け替えた（`05 open / 00 soon` → `05 open`）。

### Design Read

- **`/tickets`**: `初めてPUREの入口に立つ人` 向けの入場案内を、`nocturnal documentary`
  の語法で、`editorial（黒い紙面に実景を貼る）` に寄せて読む。
- **`/qa`**: `入る前に確かめたい人` 向けの回答を、`the wall of posted notices`
  の語法で読む。PURE の通路に実在する贈札の壁を、そのままページの素材にする。

### 統括概念と署名モーション（1ページ1つ）

| | `/tickets` | `/qa` |
|---|---|---|
| 統括概念 | 「通りから、フロアまで」。ページ自体が入場の道のり | 「壁に貼られた答え」。回答は壁に貼られた1枚の掲示 |
| 署名モーション | **通路を歩く**。実際の通路写真が消失点（`50% 42%`）を保ったまま `scale 1.02→1.46` でスクラブし、4つのビートが1つずつ入れ替わる | **一枚だけ灯る**。開いた行だけが番号をマゼンタにし、回答の左辺を1pxの光が下りる。同時に開くのは常に1つ |
| アクセント | 通路の実光＝ネオンバイオレット `oklch(0.75 0.155 313)` | 壁の実光＝ブランドマゼンタ |

### 確定した設計判断

- **署名モーションは `position: sticky` + スクラブで組む。GSAP の `pin` は使わない**。
  `.page` が `position: fixed` の独自スクローラーであるため、pin の座標計算が
  スクローラーと二重にずれるリスクがある。`.walk { height: 440vh }` ＋
  `.stage { position: sticky }` を CSS に持たせ、GSAP は transform と opacity の
  スクラブだけを担当する。実測 CLS 0.0056（4倍CPUスロットル・本番ビルド）。
- **振り付けは `isChoreographed` でオプトインする**。このクラスは
  「デスクトップ かつ reduced-motion でない」ときに JS からしか付かない。
  付かない場合（電話・reduced-motion・JS不達）は、4ビートが普通の縦組み台帳として
  全部読める。`opacity: 0` を CSS 側の初期値にすると、JS が落ちたデスクトップで
  本文が消えるため、既定値は必ず「全部見える」側に置く。
  実測: reduced-motion 時 `choreographed: false` / 4ステップとも `opacity: 1` /
  通路は `scale(1.06)` の静止画として着地。
- **チャプターレールは同じタイムラインの `onUpdate` から駆動する**。
  sticky のためスクラブ区間は `440vh - 100vh = 340vh` であり、
  `walk.offsetHeight`（440vh）で測った別トリガーを立てるとレールがステップより
  先行してずれる。トリガーを増やさず progress から index を出す。
- **写真の上の文字は実測してからスクリムを決める**（既存 Don't の適用）。
  - `/tickets` 通路のステップ本文: 3点補間では最輝パッチに対し **4.41:1** で AA 割れ。
    `96% → 86%(22%) → 46%(42%) → 4%(64%)` の4点に変更し **6.00:1**。
  - `/tickets` ヒーローの `heroFacts dt`: 入口の灯りが画面内で最も明るく、
    `--bone-faint` で **4.50:1**（境界ちょうど）。`--bone-soft` に上げて 6.47:1。
  - `/qa` ヒーローのマゼンタ見出し: 壁の実光に対し **3.01:1**（大見出しの下限ちょうど）。
    横スクリムを `90% → 70%(46%) → 28%(80%)` に締めて **3.53:1**。
    同時に画像の `brightness` を 0.62 → 0.72 に上げ、贈札の文字が読める状態を確保。
- **`/qa` のマゼンタは2値持つ**。ブランド値 `#d42966` は `--ink-0` に対し実測 4.1:1 で、
  小さい文字には使えない。作業用アクセントを `--magenta: oklch(0.645 0.192 6)`（実測 5.49:1）
  として文字と番号に使い、ブランド値は `--magenta-deep` として罫線とグラデーションに残す。
- **アコーディオンは `grid-template-rows: 0fr → 1fr`**。高さは一切測らない。
  閉じた回答は `visibility: hidden`（`transition: visibility 0s linear var(--dur-answer)`）で
  タブ順とアクセシビリティツリーから外す。実測でも閉状態のリンクは `hidden`。
- **質問と回答は同じ組版トラックに乗せる**。`--row-index` と `--row-gap` を共有し、
  `.rowTrigger` と `.answerInner` が同じ2トラックを使う。`auto` トラックのままだと
  回答本文が質問より約25px左にずれる。
- **`<dd>` に `display: contents` を使わない**。`.factBody` を実体のあるグリッドに
  したうえで値と注記を2カラムに置く。定義リストのセマンティクスを壊さない。
- **未公開枠が0になったときの数え方**。`SOON_COUNT === 0` のとき
  「00 soon」は無意味なので、`05 open` だけを出す。

### 事実の扱い（重要）

- **入場料金の実数はどこにも書いていない**。公式ソース（現行サイト・Wayback）に
  記載が無く、第三者のナイトライフ系ディレクトリにある `¥1,000 / 1D`・`¥2,000 / 4D`
  等は未確認値のため採用しない。`/tickets` は「受付でお手続き・料金はお電話で確認」
  という導線に置き換え、数値は `tickets-data.ts` の1ファイルに集約してある。
  実数が確定したらそこだけを差し替える。
- **`/qa` に載せた6件の出典**: 年齢・身分証（お客様確認済）／営業時間・年中無休
  （お客様確認済、`/access` と一致）／入場料金（確認方法の案内＋VIP時の扱いは
  現物ボード転記）／VIP（2時間制・30分前確認・サービス料10%＝現物ボード転記）／
  アクセス（`/access` と同一）／音楽（サイト自身の記述 HIPHOP・LATIN・REGGAETON）。
- **ドレスコードと支払い方法は意図的に載せていない**。確定ソースが無いため、
  最終セクションで「お電話で」と明示して受ける。`qa-data.ts` の冒頭にも理由を残した。
- **写真は実景のみ**。`website/image/` の445点から選定：
  `venue-signage-decor-005-014-dsc-0409`（心斎橋筋に面した実際の入口と看板）＝
  `/tickets` のヒーロー、`-003-006-dsc-0371`（PURE 20 ネオンの通路）＝署名モーション、
  `party-crowd-018-070-dsc-0554`（フロア全景）＝到着、
  `-004-013-dsc-0406`（贈札の壁）＝`/qa` ヒーロー、
  `-020-dsc01224`（レンガに灯る PURE）＝`/qa` 締め。

### 計測結果（本番ビルド / CPU 4倍スロットル / localhost）

| | LCP | CLS | 最長タスク |
|---|---|---|---|
| `/tickets` | 444ms | 0.0056 | 189ms |
| `/qa` | 300ms | 0 | 121ms |

コンソールエラー 0 / 両ルートとも静的プリレンダリング / 横スクロールなし
（`scrollWidth === clientWidth` @390px）。

### Don't（追記）

- Don't 独自スクローラー（`position: fixed` の `.page`）の中で GSAP の `pin` を使う。
- Don't 振り付け前提の `opacity: 0` を CSS の初期値に置く（JS 不達で本文が消える）。
- Don't sticky を含むセクションのスクラブ区間をセクション高さで測る。
- Don't `<dd>` に `display: contents` を当てる。
- Don't 公式ソースに無い料金を、第三者サイトを根拠に載せる。

---

## 2026-08-10 — 全6ルートのUI/UX精査と是正（critique → polish）

デュアルエージェント評価（デザインレビュー / 決定論的検出＋計測）と全ルートの実見を
突き合わせた結果、「AI感」の原因は装飾ではなく**構造**に3点あると判定した。
レイアウト自体は健全（`/gallery` は6セクション6ファミリー、同一ファミリー3連続ゼロ、
スクロールリスナー0件、reduced-motion は10/10ファイルで**設計された**代替を保持）。

### 原因と是正

**① `/` が別サイトの骨格のままだった**

`aria-label="Club Raia hero"`、`getComputedStyle` 由来の小数5桁（`102.546875px`）、
CSSが1行も無いテンプレート由来クラス10個、描画されない `<canvas>`、
そして**他クラブ（Jakarta）の住所・メール・電話・WhatsApp が本番HTMLに出力**されていた。

- 他クラブの連絡先ブロックと画像資産1.87MBを削除（`curl` で出力消失を確認）
- 死にリンク3本（`#countdown-2026` / `#halloween` / `#20th-after-party`。対象要素が
  リポジトリのどこにも存在しなかった）を廃止。スライド見出しは非リンクにし、
  ヒーローに実在する2つの行き先（`/gallery` `/access`）を置いた
- ゲートの `Premium Nightlife Experience` / `Click to Explore` は、来店判断に必要な情報を
  何も与えていなかった。`<h1>PURE OSAKA</h1>` ＋ 大阪・心斎橋 ＋ `22:00 to 05:00` ＋
  `Enter`（44px ピル）に置換。これで `/` に初めて `<h1>` が入った
- ヒーロー見出しが **Lora（本文セリフ）**で組まれていた。`--font-display`（Migra）に統一
- **モバイルでスライド見出しが `display: none`** だった（動画と矢印だけで店名もCTAも無い）。
  PRODUCT.md が主戦場と定めた環境で情報ゼロだったため、見出し＋CTA2本＋
  横並びページャを表示するよう作り直した
- ゲートのスクリム（フラット73%＋40→68%ランプ）がポスターを黒潰ししていた。
  中央加重の放射グラデに変更し、実景が読める状態に戻した

**② グローバルなトークン層が存在しなかった**

`:root` は `{ color-scheme: light }` の1行のみ（真っ黒なサイトで `light`）。
`--ink-*` `--bone` `--ease-*` `--font-*` は5つのCSS Moduleにコピペで再定義され、
結果 **near-black 6種・bone white 3種・アクセント5系統**、生 `cubic-bezier` 21箇所、
duration は直値68（44種）。DESIGN.md の記載値はどれも出荷されていなかった。

- ink / bone / edge / accent / font / ease / duration / z-index を `globals.css` の
  `:root` に一元化し、5モジュール174行の重複定義を削除
- `color-scheme: light` → `dark`
- 上のフロントマターを**実際に出荷されている値**へ更新（記載と実装の乖離を解消）

**③ `/vip` `/tickets` `/qa` が同一ヒーロー骨格の色違いだった**

地名ストリップ → 2行見出し（1行目ボーン/2行目アクセント）→ 左下JP2行 →
右下数値帯 → 左レール、という骨格が3ページ完全に同型で、差分はアクセント色だけ。
「同じ構造・違う塗り」は機械生成の最も分かりやすい署名である。

- **アクセントを1色に統一**（gold / neon violet / 2種のmagenta / 別pink → ブランドマゼンタ）。
  部屋ごとの色は**写真そのものの光**が担う。DESIGN.md の
  *The Photograph Carries Color Rule* に実装を一致させた
- 色を取り上げた分、**構図で差別化**した:
  - `/vip` = 中央のプレート（ワインリストの表紙）。数値は見出し下の1本の罫線に載る
  - `/tickets` = 左下に沈んだ見出し＋右辺の縦の掲示（扉脇のプレート）
  - `/qa` = 上端に貼られた掲示。下2/3は壁の写真のまま
- 中央構図に合わせて `/vip` の wash を放射グラデに作り替え（旧104degランプは
  左寄せ用で、中央が最も明るく、アクセント行が実測2.6:1だった → 4.4:1）

### 破綻していたもの（是正済み）

- **`/access` が横向きスマホで到達不能**。`.page` が `height:100dvh; min-height:640px;
  overflow:hidden`、`body` も `overflow:hidden` のため 844×390 でスクローラーが
  どこにも無く、電話番号と CTA 2本が画面外に固定されていた（`max-width:768px` の
  モバイル規則は横向き844pxでは発火しない）。`(max-height: 760px)` 側でも
  スクローラーになるよう修正。実測 `scrollHeight 602 > clientHeight 390`、
  電話番号・両CTAとも到達可能を確認
- **`styles.reveal` が3ファイルで未定義**。`class="head undefined"` が出荷され、
  GSAP が `.undefined` を animate していた（＝その入場アニメは一度も動いていなかった）。
  マーカークラスを定義。`ClubRaiaMenu` の `styles[\`${panel}Link\`]` も同種の未定義参照
- **コンタクトが実質ダイアログでなかった**。`role`/`aria-modal`/Escape/フォーカストラップ
  すべて無し、`outline:0` に代替なし、placeholder がラベル代わり、`cursor: crosshair`、
  `<main>` が2つ、`mailto` 失敗時に無反応。ダイアログとして作り直し、
  可視ラベル・電話/メール/住所の直接導線・送信後の状態表示を追加
- **日本語本文にウェブフォントが1つも読み込まれていなかった**。`--font-jp` は
  5ファイルで定義・21箇所で使用されていたが、指すフォントは全てシステム依存で、
  Android / Linux では総称 `sans-serif` に落ちていた。`Noto Sans JP` を `next/font` で追加
- `contain-intrinsic-size` が **no-op** だった（`content-visibility` も `contain: size` も
  無い）。21枚のギャラリーで意図した描画スキップが効いていなかった
- ナビが固定ヘッダー全幅で `pointer-events: auto`、全ルートの上端104pxのタップを
  奪っていた。`.controls` と ロゴのみ有効に
- ナビのスクリムが30%黒フラットで、明るい写真上の11.2pxが実測約4:1だった。
  3点ランプ（0→34%→78%）に変更
- MENUパネルの `Close` が **21.8px**（WCAG 2.5.8 の24px未満）で、パネルを閉じる唯一の手段だった
- `width` のトランジション2箇所（ヒーロー矢印のhover、Closeの罫線描画560ms）を
  `transform: scaleX()` に置換

### 表層のスロップ（除去済み）

可視文字列の em-dash 5箇所（OGP画像・VIPリスト・営業時間・About本文・メール件名）、
`Scroll` キューと無限ループ、`Access / 06`（MENUでは `03`）、座標ストリップ、
`Osaka Metro Namba Station → PURE Osaka` の装飾脚注、同一URLに別ラベルのCTA 2つ、
MENUパネルの eyebrow 6個＋タイル連番01–05＋`05 open` カウンタ、ギャラリー表紙の `21 frames`。

`/access` は独自の `--access-*` 名前空間・7pxラベル・9px CTA・`!important`×3 で
型システムから孤立していたため、共有トークンに載せ替え、下限を10pxに引き上げた。
サイトナビも持たず他ページへ行けなかったため `SiteNav` を新設して解消。

### `/access` の地図

Google Maps の **embed エンドポイントは配色パラメータを取らない**（Styled Maps は
JS API と課金キーが必要）。キー無しで黒い紙面に道路地図を載せる唯一の方法として
`invert(0.93) hue-rotate(180deg) saturate(0.78) …` を1回だけ適用する。
アニメーションはしないのでホットパスには乗らない。

### 計測（本番ビルド）

`next build` 成功・全6ルート静的プリレンダリング / `tsc --noEmit` `eslint .` ともに0件 /
全ルートで `<h1>` ちょうど1つ・skip link あり・em/en dash 0・`undefined` クラス0・
`<main>` 1つ・他クラブ由来データ0 / 横スクロールなし（390 / 844 / 1440）。
Impeccable ディテクタ 5件 → 3件（残る3件は地図面の除外規定・`@supports` で
守られた署名モーション・CSSコメント内の `<img>` 文字列の誤検出）。

### Don't（追記）

- Don't トークンをページ側の `.page` ブロックで再定義する。`:root` に1つだけ置く。
- Don't ページの差別化をアクセント色だけで行う。骨格が同じなら色を変えても同じページである。
- Don't `contain-intrinsic-size` を `content-visibility` 無しで書く（何も起きない）。
- Don't 固定ヘッダー全体に `pointer-events: auto` を置く。
- Don't `styles.x` を、そのモジュールに定義の無いクラス名で参照する（再発2回目）。
- Don't 全画面オーバーレイを `role="dialog"` 無しで出す。
- Don't 日本語の本文スタックを、ロードしていないフォント名だけで組む。
- Don't `overflow: hidden` の独自スクローラーに `min-height` の下限を置く
  （短いビューポートで中身が到達不能になる）。

### 未着手（要判断）

- **`Migra` / `Univers LT Pro` は商用フォント**で、`/the-cross/` から生TTF（計229KB）で
  自己ホストされている。ライセンス取得状況の確認が必要。取得済みなら WOFF2 化と
  `size-adjust` によるメトリクス整合で、全ルート最大の文字のスワップずれも同時に解消できる。
- ホームの動画3本 **計49.5MB** が入口ルートにある。Page Visibility による一時停止は
  入れたが、`Save-Data` / `effectiveType` によるゲートは未実装。
- ホーム動画のソース自体に角丸マスクと黒帯が焼き込まれており、横長ビューポートで
  左に黒帯が出る。再書き出しが必要（CSS では解決できない）。
- `purelogo.png` が 1.31MB。`next/image` を通る画面表示は問題ないが、
  `opengraph-image.tsx` が毎回 base64 展開している。

---

## 2026-08-10 (2) — `/vip` ヒーローの構図差し戻しと、ホーム動画の配信設計

### `/vip` を中央寄せから左寄せへ戻した

同日の是正で `/vip` のヒーローを中央のプレートに変えたが、**これは誤りだった**。
このルートの背景写真はVIPボードが画面のほぼ中央にあり、中央に組んだ見出しは
必ずその上に落ちる。写真の被写体位置を見ずに、他ルートとの差別化だけを理由に
構図を決めたことが原因。

差し戻したうえで、3ルートの差別化は**縦のリズム**で取り直した:

| | 型の位置 | 数値の扱い |
|---|---|---|
| `/qa` | 上端（貼られた掲示） | なし。下2/3は壁の写真 |
| `/vip` | 中央高さに1ブロック | 見出し直下の1本の罫線に載る |
| `/tickets` | 左下（扉の高さ） | 右辺の縦の罫線に沿う掲示 |

3ルートとも型は**左**に置く。3枚の写真がいずれも被写体を中央に持つため。

- `.heroTitle` を `clamp(3.4rem, 8.4vw, 7.6rem)` に落とした。この写真ではボードが
  横位置およそ39%より右を占めるので、最長行 `TABLES` が1440pxで約395px（右端x≈485）に
  収まり、ボードの文字（x≈610〜）と重ならない。1920 / 1440 / 1100 / 960 / 390 で実測確認。
- 2行目のインデント（`margin-left: clamp(0px, 4vw, 96px)`）を **このルートだけ0** にした。
  段差はボードへ向かって単語を歩かせるだけで、プレートとしての読みも弱めていた。
- `heroWash` も左加重の104degランプへ戻した（中央加重の放射は中央構図用だった）。
- 900px以下ではボードが型の横に来ないので、display のサイズを戻す。

**Don't（追記）**: Don't 写真の被写体位置を確認せずにヒーローの構図を決める。
差別化は構図の選択肢の1つに過ぎず、可読性より優先されない。

### ホーム動画：前回の診断を訂正し、実際に効く最適化を行った

**訂正**: 前回「ソースに角丸マスクと黒帯が焼き込まれている」と報告したが、**誤り**。
`cropdetect` を3ファイル×3時点で実行するといずれも `crop=720:1280:0:0`（黒帯なし）、
フレームを抜き出しても素の全画面縦動画だった。デスクトップで左に見えていた暗部は、
**9:16の縦動画を16:10の横長ヒーローに `object-fit: cover` した結果**、
中央の帯だけが残り、その帯では通路の壁が実際に暗い、というだけのものだった。
（同時に720px幅の素材を1440pxへ2倍に引き伸ばしている。）

**再エンコードでは縮まない**ことも実測で確認した。H.264 CRF 26/28/30 と VP9 CRF 34 を
試したが、いずれも原本（11.7MB）と同等かそれ以上。原本は既に効率的に符号化されており、
サイズを決めているのは**尺**（55〜71秒）だった。

したがって効く手を打った:

1. **16秒ループに切り出した**。ヒーローは `playFromStart` で必ず0秒に戻すため、
   尾の40〜55秒は実際にはほぼ再生されない。
2. **2幅 × 2コーデックを用意**し、`<source>` の `media` と `type` で出し分ける。
   順序は「電話向け → 全幅」「WebM → MP4」。
3. **VP9のCRFを実測で較正した**。当初のCRF 33/34ではWebMがMP4より**大きく**なり、
   ブラウザがWebMを先に選ぶぶん逆効果だった。busiestなフレーム（路上のNYEポスター）で
   比較し、CRF 42 が H.264 CRF 25 と見分けがつかず37%小さいことを確認して採用。
4. **`Save-Data` / 2G ではソース自体を出さない**。ポスターは同じクリップの実フレームなので、
   失われるのは空気であって情報ではない。`useSyncExternalStore` で読む
   （サーバは許可側を返し、ハイドレーション後と接続変化時に読み直す）。
5. **原本は `media-masters/` へ退避**し `.vercelignore` に追加。配信されないが再カットには残る。

| | 変更前 | 変更後 |
|---|---|---|
| 初回訪問（デスクトップ / WebM） | 11,683 KB | **2,812 KB** |
| 初回訪問（電話 / WebM） | 11,683 KB | **1,752 KB** |
| 3スライド全部見た場合 | 50,736 KB | **8,184 KB** |

**残る制約（素材側）**: デスクトップの精細感は素材で頭打ち。720px幅の縦動画を
1440px以上へ引き伸ばしているため、横長ビューポート向けには**横位置で撮影／書き出した
素材が別途必要**。CSSでもエンコードでも解決できない。

### Don't（追記）

- Don't 「重い＝符号化が甘い」と決めつける。まず尺・解像度・実測ビットレートを見る。
- Don't WebMを追加したら軽くなると仮定する。CRFを較正せずに置くとMP4より重くなる。
- Don't 縦動画を横長ヒーローの全面素材として使う（2倍拡大＋被写体の切り落とし）。

---

## エントリーヴェール（PureGateLoader）

Apple Store iOS の Loading screen（中央マーク＋細いプログレス弧）を構造の下敷きにし、
中央を PURE のマークに置き換えたもの。参照は白地だが、**PURE では地を `--ink-0` にした**。

### 判断とその理由

1. **白ではなく闇にした。** サイト本体が `--ink-0` の暗色なので、白いヴェールは
   初回ペイントで全画面フラッシュになる。加えてマークの焼き込みグローは白地では消える。
   参照の「構造」は踏襲し、「色」はブランド側に従わせた。
2. **不定スピナーではなく確定プログレスにした。** 弧は `--p`（0→1）で描かれる。
   `document.readyState === "complete"` かつ最低保持時間を過ぎたら閉じ、
   `MAX_WAIT_MS = 2800` で必ず打ち切る。ネットワークを無限に待つ演出はしない。
   0.92 で待機するのは、閉じきった弧を見せながら実際は待っている、という嘘をつかないため。
3. **署名モーションは「出口」に置いた。** 点灯したマークが、そのまま
   `.pure-corner-logo` の位置へ飛ぶ。両者は同じクロップ枠（623x699、
   `scripts/build-pure-mark.mjs` と globals.css で共有）なので、
   中心とwidthを合わせるだけの `translate3d + scale` で厳密に着地する。
   ヴェールが消えて別の画面が現れるのではなく、一続きの入場として読ませるための選択。
4. **点灯はフィルタではなくグラデーション円のオペシティで作った。**
   `filter` はペイントが重く合成レイヤに乗る保証がない。背面の円を
   opacity + scale させることでコンポジタのみで「看板が点く」を表現している。
5. **毎回のドキュメント読み込みで再生する（指定）。** クライアント遷移では
   レイアウトが保持されるのでサイト内移動では再生されず、リロードでは再生される。
   当初は `sessionStorage` で1タブ1回にしていたが、指定により撤去した。
6. **クリック式 Enter ゲートは廃止した。** ヴェールが到着を覆うので、
   その直後にもう一枚扉を置くと「二重の関所」になる。ヴェール明け＝ヒーロー本体
   （動画は即再生）。ゲートが持っていた `<h1>` はページ唯一の見出しだったため、
   `pure-visually-hidden` でヒーローに移設した（ヒーローは映像なので画面には出さない）。

### 数値

| | 値 |
|---|---|
| マーク素材 | `public/pure/pure-mark.webp` 440x494 / **41.9 KB**（原本 1,344 KB から 33 分の 1） |
| 実測シーケンス長 | 点灯 1.87 秒 / 除去 3.02 秒（体感の拘束は約 2.3 - 2.7 秒） |
| 尺のダイヤル | `MIN_HOLD_MS`（現 1250ms）。ここだけで全体の長さが決まる |
| 操作でのスキップ | pointerdown / Tab 以外のキー / Skip intro ボタン |

### Don't（追記）

- Don't ヴェールをクライアント専用にする。ハイドレーション後にマウントすると
  「サイトが1フレーム見えてから」ヴェールが被さる。サーバHTMLに含めること。
- Don't `sessionStorage` をレンダー毎に読む。開始時に書き込むので、
  次のレンダーで `true` に反転してシーケンス途中で消える。読み取りは1回に固定する。
- Don't Tab キーをスキップ操作に含める。Skip intro ボタンへ到達できなくなる。
- Don't ヴェールの後ろにもう一枚クリック式ゲートを置く。入場が二段になる。
- Don't ゲートを消すときに `<h1>` ごと消す。ページから見出しが消える。
- Don't `prefers-reduced-motion` で inline の飛行 transform を残す。
  インラインはCSSの静止指定に勝つので、飛ばずに一瞬でワープする。

---

## 2026-08-10 — 型トークンの復旧とHero CTA対の是正（polish）

指摘は二点だった。「HOMEの see the night / hours & access ボタンがAI感が強すぎて崩壊
している」「MENUのフォントサイズとSNSアイコンが小さい」。どちらも表層ではなく、
**型トークンが一度も適用されていなかった**ことに起因していた。

### 実測した崩壊原因

1. **`--font-display` と `--font-meta` は `:root` で無効値だった。**
   両者は `var(--font-playfair)` / `var(--font-open-sans)` を内側に持つが、
   next/font の変数クラスは `<body>` に付いていた。カスタムプロパティ内の
   `var()` は**宣言された要素**で解決されるため、`:root` では未定義 →
   invalid at computed-value time → `font-family: var(--font-meta)` は
   `unset` になり **body の Lora セリフを継承**していた。
   `getComputedStyle(:root)` での実測値は空文字列。

   結果：Migra と Univers は読み込まれていたが**一度も描画されていなかった**。
   `--font-meta` / `--font-display` の利用箇所は9ファイル約76か所で、
   ナビゲーション、CTA、キャプション、見出しのすべてが Lora だった。

2. **`font:` ショートハンドは丸ごと捨てられていた。**
   `.pure-hero-action { font: 600 11px/1 var(--font-meta) }` は
   font-family が無効なため**プロパティ全体が無効**になり、font-size と
   font-weight と line-height も消えた。実測 **16px**。
   `letter-spacing: 0.18em` は別宣言なので生き残る。
   つまり「16pxのセリフ大文字を0.18emで間延びさせた文字列」が
   52pxのピルに入っていた。これが「崩壊」の実体である。
   同じ書き方が skip-link、contact の送信ボタン、ゲートの Skip にもあった。

3. **モバイルのピルは `justify-content: space-between` だった。**
   全幅に伸びた面の左端にラベル、右端に円形矢印が飛び、間に手のひら幅の
   空白が残る。ボタンが割れて見える直接の原因。

4. **ナビゲーションとSNSは実測で小さかった。**
   1440pxで nav 11.2px、モバイルで **9.75px**。SNSは36pxの輪に17pxの字面、
   輪の線は28%（サイトの `--edge-strong` は40%）。76pxのロゴの隣で
   付け足しに見える。MENUパネルの日本語補助ラベルは10px。

### 確定した設計判断

1. **フォント変数は `<html>` に付ける。** 役割トークンを `:root` で組むなら、
   参照される変数も `:root` に存在しなければならない。これで Migra と
   Univers が全ルートで初めて描画される。

2. **`font:` ショートハンドは使わない。** 4か所すべてを longhand へ。
   1つの未定義変数でサイズと太さまで消える書き方を残さない。

3. **CTAは対ではなく主従にする。** 同じピル・同じ円形矢印・同じ重さの二つを
   並べる形は、階層が無く、最もテンプレート的なCTAでもある。
   夜そのものが提供物なので `See the night` が塗りピル（56px、
   Univers 13.7px/0.17em、接触影+環境影）、`Hours & access` は
   **サイト自身の1px罫線**（ナビのhoverとMENUタイルの `labelRule` と同じ所作）
   を持つ静かなリンクにした。ガラス（`backdrop-filter`）と二つ目の
   円形バッジは撤去。1ビューポート1主役。

4. **矢印は文字ではなく1つの図形にする。** MENUタイルの `↗` は Univers に
   無い字なので、プラットフォーム任せのフォールバックで描かれていた。
   `ArrowUpRight` に一本化し、stroke を 1.4 → 2 にした
   （24単位の箱を13pxで描くと 0.76px = サブピクセルで灰色に潰れる。
   16px×stroke2 で 1.33px、Univers 13.7px のステム幅と一致する）。

5. **ヒーローの床は1枚に保つ。** 検討中に `.clubraia-vignette` へ
   2枚目のスクリムを足したが、既存の `.clubraia-hero::after` だけで
   足りることを実測した。3クリップ中最も明るいフレーム（Halloween、
   CTA帯の生ビデオ輝度 max L=0.977）でも、合成後の背景は max L=0.084、
   Bone White とのコントラストは **6.96:1**。二重に暗くする理由はない。

6. **操作の下限を決める。** `typography.control`（12〜14.5px、0.17em）を
   役割として追加した。指とカーソルが触るものはすべてここに乗る。
   8pxの `label` はキャプション専用に戻す。
   SNSは44px（デスクトップ・モバイル共通）／字面21px／輪は `--edge-strong`。
   MENUパネルの日本語ラベルは10px → clamp(12px, 0.9vw, 13.5px)。

### 計測

| | 変更前 | 変更後 |
|---|---|---|
| Hero CTAラベル | 16px Lora（指定11pxが消滅） | 13.7px Univers |
| nav ラベル（1440 / 390） | 11.2px / 9.75px Lora | 14.1px / 12.5px Univers |
| SNS 輪 / 字面（モバイル） | 30〜34px / 16〜18px | 44px / 20px |
| MENU 日本語ラベル | 10px | 13px（モバイル12px） |
| `Hours & access` の実測コントラスト | 未計測 | 6.96:1（最悪フレーム） |
| 全6ルートの横溢れ / 文字クリップ | - | 0 / 0 |

### Don't（追記）

- Don't `:root` の役割トークンから、`<body>` にしか無い変数を参照する。
  黙って継承値に落ち、フォントが一度も適用されないまま見た目が成立する。
- Don't `font:` ショートハンドに `var()` のフォントファミリを混ぜる。
  変数が無効ならサイズと太さも一緒に消える。
- Don't 主CTAと副CTAに同じ形・同じバッジ・同じ重さを与える。
  それは選択肢ではなく、階層の放棄である。
- Don't 全幅ピルに `justify-content: space-between` を使う。
  ラベルと矢印は1つの単位。伸びるのは面だけ。
- Don't Unicodeの矢印記号をアイコンとして使う。字面を持たない書体では
  フォールバックが選ばれ、線幅がページのどことも一致しない。
- Don't スクリムを足す前に合成後の輝度を測らずに暗くする。
  既存の1枚で6.96:1出ているなら、2枚目は映像を殺すだけ。

---

## 2026-08-10 (3) — CTAの再設計・エントリーヴェールの刷新・HOME追加・モバイル全面是正・ABOUT再構築

指摘は5件。「See the night と Send のAI感」「ヴェールをさらに圧巻に」「HOMEをmenuの左へ」
「全ページのモバイルが崩壊している」「ABOUTのAI感」。以下、原因と是正。

### 1. CTA — 「同じピル＋丸囲み矢印」を全ルートから撤去

**原因。** 同一のオブジェクトが5モジュールに複製されていた。`border-radius: 999px` の
ピル、11pxのトラッキング大文字、右端に寄せた**丸囲みの斜め矢印**。モバイルでは
`justify-content: space-between` で全幅に伸び、ラベルが左端・矢印が右端に飛んで
あいだに200px近い空白が残る。これは生成系Webで最も複製されているボタンそのもので、
PURE由来の要素が一つも無い。

**是正。** `.pure-cta` を `globals.css` に一つだけ定義し、Hero / Contact / VIP /
Tickets / Q&A / Gallery / Access の7か所すべてを差し替えた（各モジュールの
`.action` `.actionGhost` `.actionIcon` は削除）。

- 形は**角のある看板の板**。`rounded.square` と同じ縁で、写真面・メニュータイルと揃う。
- ホバーで**カーボンが左から流れ込み、下辺にマゼンタのフィラメントが点く**。
  ヴェールの点火と同じ「灯る」動作を、ボタンの寸法で繰り返す。
- マークは丸囲みの矢印ではなく**罫＋矢じり**（`CtaMark`）。Heroの prev/next は元から
  「112pxの罫＋矢印」であり、これは借り物ではなくこの建物の既存のジェスチャー。
  ホバーで罫が伸びる（回らない）。
- モバイルは `width: 100%; max-width: 420px` で伸びるが、ラベルとマークは中央で
  1つの単位のまま。空白は生まれない。
- Access の `Get directions` はマゼンタ塗り（`--accent-deep` に暗色文字＝4.1:1）を
  やめ、同じ板に統一した。

### 2. エントリーヴェール — 円環を「扉に断ち切らせる」

**原因（なぜ圧巻でなかったか）。** 構図が完全に対称・静止で、1.25秒のあいだ動くのは
直径300pxの円周を這う1pxの弧だけ。スマートフォンでは「ほぼ何も起きていない」。
リングがOSの進捗スピナー以上の意味を持っていない。そして退場が**クロスフェード**で、
サイトが「現れる」瞬間が存在しなかった。

**是正（円形は維持）。** クライアント指定により円環は残す。残したうえで、
「スピナーではなく**印章**」「消えるのではなく**断ち切られる**」の2点で作り直した。

- リングに**会場の住所を円弧上に組んだ**（`textPath`、`SHINSAIBASHI, OSAKA`）。
  中央のマークが既に PURE OSAKA と読めるので、円弧に載せるのは**名前ではなく場所**。
  同じ語を1つの円の中で二度言わない。これでリングは「進捗の輪」ではなく
  「この店の印」になり、リングがこの直径である理由も生まれる。
- リング全体が進捗に応じて `scale(0.945 → 1)` で**マークに寄っていく**。
- 地面を**上下2枚のリーフ**に分け、**リングを各リーフの中に1つずつ描いた**。
  閉じているあいだは2つが完全に重なって1本の連続した円に見え、扉が開くと
  **円が上下に裂ける**。ブランドマークだけは `stage` レイヤーに載せて切られず、
  実測位置でコーナーロゴへ飛ぶ。
- 合わせ目は中央を横切らせず、**画面両端の見当マーク**にした（`transparent 7%〜93%`）。
  マークとリングの上に線を引くと構図が汚れる。端だけなら「ここで割れる」とだけ言える。
- `prefers-reduced-motion`: リングは閉じた状態、住所は定位置、マークは点いた状態。
  リーフは移動せずフェードする（`animation: none` ではなく到達状態を書いている）。

### 3. HOME

`primaryNavigation` の先頭に `Link href="/"` を追加。3つのパネルは overlay なので
button のまま、HOME だけが「場所」なので anchor。現在地は `aria-current="page"` で、
既存のホバー罫を出したままにする（色を変えない＝写真の上でも生き残る）。
`.mainLink` は `display: inline-flex` にした。anchor の既定 inline では 44px の
ターゲット高さも、罫の含有ブロックも成立しない。

### 4. モバイル — 「崩壊」の系統的な原因は2つ

**原因A: `--nav-safe` が高さ由来だった。** `clamp(84px, 10.5vh, 116px)`。
390×844では88pxに解決される一方、モバイルのヘッダは「4ラベルの行＋44pxのSNS行」で
実測102px。差の14px＋αが、`/vip` `/tickets` `/qa` `/gallery` すべての
最初の1行をナビゲーションの下に描いていた。
→ ヘッダ自身の寸法から算出する式に置換（`--header-top` + `--header-row` + 余白）。

**原因B: モバイルヘッダが2段だった。** SNSを追うことはナビゲーションの仕事ではない。
812px以下ではヘッダを**1行**にし、YouTube / Instagram は MENU パネル内に
ラベル付きで移した（ABOUT・CONTACTと同じ2×2）。344px以下では ABOUT のみ落とす
（MENU内に同名の入口があるため）。ロゴは50pxにして操作行と光学的に中心を揃えた。

その他の是正:

| 症状 | 原因 | 是正 |
|---|---|---|
| `/access` 下端に約90pxの死んだ黒 | `.stage` の `min-height: calc(100dvh - 86px)` | `min-height: 0`、`margin-top: var(--nav-safe)` |
| `/access` 地図がナビと衝突・Googleのチップが枠に被る | カードが y=0 から始まる | 上記＋iframeを46px上へオーバースキャン（帰属表示は残す） |
| `/gallery` モザイクが右端を19px超過 | `.frame` が `width: 100%`（グリッド領域幅）で、その上に `margin-left: 10vw` を足していた | マージンではなく `justify-self` + `width: 86%/90%` |
| 9px / 10px のラベルが全ルートに散在 | 各モジュールで直値指定 | `--fs-micro` / `--fs-label` に集約。1024px以下で 10.5 / 11.5px へ |
| フッタリンクのタップ高17px | inline のまま | `min-height: 24px`（WCAG 2.2 2.5.8） |
| CONTACTがカード in カード、SEND前後が間延び | 外枠 padding + 1px罫 + `ink-1` の面 | 860px以下で枠を外し、入力は48px/12pxに詰めた |
| MENUパネルの `Choose your night` が上端で切れる | `--pad-top: 100px` 固定 | `calc(var(--nav-safe) + 14px)` |

### 5. ABOUT — 生成系の既定を全部外す

**原因。** letter-spacing 24px の中央寄せ Playfair、サイトのどこにも無い青
（`oklch(82% 0.07 235deg)`）のチップ列、`Osaka roots. / Global rhythm.` という
2語対句、日本語本文とその**英訳の重複**、構図の途中に置かれた著作権表示、
38%まで落として壁紙にした写真。加えて背景が独自の青黒（`oklch(14% 0.025 255deg)`）で、
本文フォントが `Hiragino Kaku Gothic ProN` 直書き（LinuxとAndroidに存在しない）。

**是正。**

- 写真は**減光せず**、左（モバイルは上、4:3）に実寸で置く。文字側との境界は
  半透明パネルではなく**値の落ち込み**で作る。
- 見出しは Migra で `ONE BASEMENT / IN SHINSAIBASHI`。実在の場所を名指す。
  演出は2行のマスク上げのみ（短い見出しの1文字ずつのアニメーションは、
  この改修が取り除こうとしている癖そのもの）。
- 日本語を主役に。ステートメントは Shippori Mincho、本文は Noto Sans JP。
  英訳の重複段落は削除した。
- 事実はチップではなく**罫の台帳**（Since / Floor / Sound / Doors）。
  すべて `/access`・`/tickets` が既に公開している値のみ。新しい断定はしていない。
- 著作権表示は撤去し、出口として `Find the venue`（ghost CTA）を1つだけ置いた。

### Don't（追記）

- Don't `--nav-safe` のようなクリアランスを **vh** から作る。
  ヘッダの高さは画面の高さと無関係で、必ずどこかの画面でずれる。
- Don't グリッド項目に `width: 100%` を与えたまま `margin` でリズムを作る。
  トラック幅にマージンが上乗せされ、端から溢れる。`justify-self` と `width` を使う。
- Don't 毎フレーム `letter-spacing` を書く。transform/opacity と違い、
  文字のレイアウトが走る。トラッキングの演出は1回のキーフレームで。
- Don't 重ねた要素の一方に境界線を描いて、あとから来る兄弟で塗り潰す。
  ヴェールの合わせ目は `z-index` を与えるまで一度も見えていなかった。
- Don't 円環の中に、中央のロゴが既に言っている語をもう一度置く。
  1つの円の中で同じ単語が二度読めるのは、装飾であって情報ではない。
- Don't `prefers-reduced-motion` のリセットを、演出側より弱い詳細度で書く。
  `.open .title span` の 600ms は `.title span` のリセットに勝つ。
  ステージャは変数（`--line-delay`）にして1か所で無効化する。

---

## 2026-08-10 (4) — モバイルHOMEにSNSが存在しなかった件と、ヒーロー底部のレール化

### 症状と原因

モバイルのHOMEにYouTube／Instagramが見当たらない。実測すると、2つの `<a>` は
**ヘッダのDOMには存在するが `0×0` で描画されていた**。

```
{ label: "PURE Osaka on YouTube", display: "grid",
  parentDisplay: "none", box: { w: 0, h: 0 } }
```

原因は前回の是正 (`2026-08-10 (3)`) 側にある。モバイルヘッダを1行化した際、
`ClubRaiaMenu.module.css` の812px以下で `.socialLinks { display: none }` とし、
SNSの行き先をMENUパネル内に限定した。結果、**HOMEでは0か所**、他ルートでも
MENUを開くまで到達できない状態になっていた。ヘッダの高さ問題は解けたが、
到達性を落としていた。加えて `SOCIAL_LINKS` とアイコンSVGが
`ClubRaiaMenu.tsx` と `ClubRaiaAllPanel.tsx` に**二重定義**されており、
片方を消しても気づけない構造だった。

### 是正

**定義を1つに。** `src/components/social.tsx` に `SOCIAL_LINKS` /
`YoutubeIcon` / `InstagramIcon` を集約し、ヘッダ・MENUパネル・ヒーローが
同じ1つを参照する。

**ヒーロー底部を1本のレールにした。** 従来の底部は3つの独立した操作群だった：

| 要素 | 位置 (390×844) | 問題 |
|---|---|---|
| prev/next 矢印 | y 744–789、左右端 | 数字ページャと**7px重なる** |
| ページャ `01 02 03` | y 782–814、中央 | 同一状態に対する2つ目の操作 |
| SNS | — | **不在** |

これを `--gutter` 幅の**罫線1本の帯**に統合した。左=現在地（ページャ）、
右=SNS。デスクトップでは `.pure-hero-social { display: none }` となり、
レールは従来どおり右下の縦ページャに戻る（ヘッダがSNSを持つため）。

- **矢印は812px以下で撤去し、スワイプに置換**（`Hero.tsx`、閾値44px、
  横成分が縦成分を上回る場合のみ発火）。1つの状態に3つの操作は多い。
  ページャだけは「操作」と「現在地の表示」を兼ねるので残す。
- **ページャは「目盛りと灯」に**。3本とも罫を持つが、非選択は `--edge`、
  選択のみ `--accent`。状態を色だけに載せない（罫の有無＝非色の手掛かり）。
- **SNSマークは押すと反転する**。休止時は `--edge` の細い輪＋骨白のグリフ、
  押下／ホバーで輪が中心から骨白に満ち、グリフがカーボンへ。
  `.pure-cta` の「看板が灯る」と同じ動作を、ランプの寸法で繰り返す。
  タッチにはホバーが無いので `:active` にも同じ状態を与えている。

### 併せて発見・修正した潜在バグ

`globals.css` の `@media (prefers-reduced-motion: reduce)` が**438行目**に
あり、上書き対象の `.pure-cta`(608) `.pure-hero-social a`(781)
`.clubraia-page-dot`(842) `.pure-corner-logo` はすべてそれより**後**に
同詳細度で `transition` ショートハンドを宣言していた。カスケードは後勝ちなので、
**このブロックは丸ごと死んでいた**（実測 0.24s / 0.32s のまま）。
ブロックをファイル末尾へ移動。移動後の実測：

| | reduced | normal |
|---|---|---|
| `.pure-cta` | 0.001s | 0.18s, 0.26s, 0.18s |
| `.pure-cta::before` | 0.001s | 0.46s |
| `.pure-hero-social a` | 0.001s | 0.24s, 0.18s |
| `.clubraia-page-dot` | 0.001s | 0.18s |
| `.pure-corner-logo` | 0.001s | 0.18s |

### 動作検証（実操作）

| 操作 | 期待 | 結果 |
|---|---|---|
| タップ | 変化なし | index 0 → 0 ✅ |
| 左スワイプ ×2 | 次へ | 0 → 1 → 2 ✅ |
| 右スワイプ | 前へ | 2 → 1 ✅ |
| 20pxドラッグ | 閾値未満で無視 | 1 → 1 ✅ |
| 縦優位ドラッグ | 無視 | 1 → 1 ✅ |
| ページャ `03` タップ | 3枚目 | → 2 ✅ |

### Don't（追記）

- Don't 「置き場所が他にもあるはず」で要素をブレークポイントから消す。
  消した先が2タップ深ければ、それは移動ではなく**削除**である。
  実測は `display:none` の親を持つ `0×0` の `<a>` として現れる。
- Don't 同じURLとSVGを2ファイルに書く。片方の表示を止めたとき、
  もう片方が到達可能かどうかを誰も検算しない。
- Don't `@media (prefers-reduced-motion)` を、上書き対象より前に置く。
  同詳細度なら後勝ちで、ブロックは静かに無効化される。
  配置を変えたら必ず `transitionDuration` を実測して効いていることを確かめる。
- Don't 1つの状態に3つの操作（矢印・ページャ・スワイプ）を並べる。
  タッチで最初に試されるジェスチャーを1つ用意し、位置表示は1つに絞る。

## 2026-08-10 (5) — /qa モバイルヒーロー崩壊：メディアクエリの「後ろ」に置かれた無条件ブロック

### 症状

390×844 で、見出し `BEFORE / YOU COME` の下に**何もない帯が 439.6px**（画面の
52%）開き、日本語リードだけが最下部に取り残される。背景写真は下半分が
ほぼ真っ黒（実測 L≈0.0025）で、このページの支配概念である「贈札の壁」が
モバイルでは一切見えていない。834px（タブレット）以上では正常。

### 原因（3層あった）

**1. カスケード。** `QaExperience.module.css` の末尾に、`@media (max-width: 760px)`
**より後ろ**へ無条件ブロックが追記されていた。

```css
@media (max-width: 760px) { .hero { grid-template-rows: auto auto 1fr; } }
/* ...この後に... */
.hero { align-content: start; }   /* ← メディアクエリは詳細度を上げない＝後勝ち */
```

ハンドセットでは両方が生き、`align-content: start`（＝行を上に詰める）と
`1fr` の第3行（＝リードを持つ行が余白を全部吸う）が同時に成立する。
実測 `grid-template-rows: 13px 109px 464px`。**464pxの行に53pxの中身**、
つまり組版の内側に画面の半分の空白が開いた状態だった。
`2026-08-10 (4)` の reduced-motion と同型の事故で、向きが逆（今回は
無条件ブロックが後ろ、前回はメディアクエリが前）。

**2. ウォッシュの軸。** `.heroWash` の主グラデーションは `100deg`、つまり
**横方向**。「左を暗く／右で写真を見せる」というデスクトップの横長構図用で、
390px幅の縦長では走る距離が390pxしかない。加えて下端の
`0deg, 92% → 66%(22%) → transparent(54%)` が下半分を潰し、写真は黒面と化す。

**3. 縦のクロップ。** 3:2 の写真を 0.46 の枠に `cover` すると幅の約31%しか
残らない。`object-position: 50%` はその31%を**贈札の壁とネオンの中間**に置き、
両方を半分ずつ切っていた。

副次的に、`.heroLine:last-child { margin-left: 8px }`（＝意図の読めない
8pxのズレ）、`.heroLead { font-size: clamp(13px, 1.05vw, 16px) }`（1.05vw は
モバイルで4px＝常に下限に張り付く）、320pxでアイブロウが2行に割れる、
の3点も同時に出ていた。

### 是正

**構図＝「掲示された貼り紙」を1ブロックに溶接した。** 末尾ブロックは
`.hero` 等の本来の宣言へ畳み、ハンドセットは
`grid-template-rows: auto auto auto 1fr` に変更。**伸びるのは4行目だけ**で、
アイブロウ・ディスプレイ・リードは常に隣り合う。空いた 448px は写真が持ち、
その底に終端（`.heroCue`）を1つ置いた。

| | before | after |
|---|---|---|
| 行構成 (390×844) | `13 / 109 / 464` | `13 / 122 / 53 / 448` |
| 見出し→リード | 439.6px の空白 | 21.9px（gap） |
| 壁の輝度 y420–600 | L 0.003–0.03 | L 0.016–0.047 |

- **ウォッシュを縦軸に**（ハンドセット時のみ）。上90%→30%地点80%で組版を守り、
  44–82%を26–36%まで開いて贈札を見せ、100%で74%に戻して終端を沈める。
- **写真を `brightness(0.8) / saturate(0.72)`**。ウォッシュを開けるとネオンの
  マゼンタが壁に回り込み、accentを1色に絞る規律が壊れるため彩度で戻す。
- **`object-position: 38% 50%`**。焦点を二分せず、贈札の壁を枠の中央に置く。
- **横向き（`orientation: landscape`）は横軸のウォッシュに戻す**。縦軸のままだと
  リードが壁の明部に乗り 4.02:1（AA未満）。是正後 6.85:1。
- **ディスプレイを `clamp(3.25rem, min(17vw, 13vh), 5.25rem)`**。17vwで縦長の
  余白を使い切り、`13vh` が横向きのときだけ効いて枠外への押し出しを防ぐ。
- **段差を `0.42em`**（＝文字サイズ連動）。8px固定は「揃え損ない」に見えていた。
- **リードを `clamp(13.5px, 3.6vw, 15px)` / `line-height 1.9`**。
- **アイブロウの2つ目を `Before you come` → `House notes` に**。H1と一字一句
  同じで、320pxで2行に割れる原因でもあった。他ルートは
  `Entry & door` (/tickets)、`Shinsaibashi` (/vip) と**H1と別の主題**を置いている。
- **`.heroCount`（`07 questions`）を `.heroCue` に置き換え**。`display:none` で
  DOMにだけ残っていた飾りのタリーを、`#questions` へ送る44px高のリンク＋
  下向き矢印にした。全画面のカバーには終端が要る。

### 検証（実測）

| 項目 | 実測 | 判定 |
|---|---|---|
| リード（bone 64%, 14px）390×844 | 6.13:1 | AA 4.5 ✅ |
| `YOU COME`（accent, 66px）390×844 | 4.79:1 | AA-large 3.0 ✅ |
| アイブロウ 390×844 | 7.23:1 | ✅ |
| `.heroCue` 390×844 | 4.83:1 | ✅ |
| リード 740×360（横向き） | 6.85:1 | ✅（是正前 4.02 ❌） |
| `.heroCue` 740×360 | 4.83:1 | ✅（是正前 4.26 ❌） |
| フォーカス | 179×44、accent 2px / offset 6px | WCAG 2.5.8 / 2.4.11 ✅ |
| reduced-motion | cue・foot・word とも opacity 1 / transform none / animation none | ✅ |
| コンソール | error 0 / warning 0 | ✅ |
| `next build` | 成功（11ページ静的生成） | ✅ |

確認済み: 320×700 / 390×844 / 430×932 / 740×360 / 834×1112 / 1440×900。
834以上は構図・ウォッシュとも従来のまま（アイブロウ文言のみ変更）。

### Don't（追記）

- Don't メディアクエリの**後ろ**に無条件ブロックを追記する。詳細度は同じで
  後勝ちなので、ブレークポイント側の意図が黙って壊れる。`2026-08-10 (4)` と
  同型。**構図の宣言は必ず本来のルールへ畳み、末尾には何も置かない。**
- Don't `1fr` の行に**読ませたいテキスト**を入れる。伸ばしていいのは
  終端か余白であって、組版の一部ではない。
- Don't 横長用の `Ndeg` グラデーションを縦長にそのまま持ち込む。走る距離が
  変われば同じ角度でも別の絵になる。縦では写真が黒面になり、
  「背景写真が良い」という前提ごと消える。
- Don't `vw` だけで本文サイズを決める。`1.05vw` はモバイルで4px、
  つまり**どの端末でも下限**。実質ハードコードと同じ。
- Don't アイブロウにH1と同じ文字列を置く。重複であるうえ、狭い端末で
  最初に折り返して崩れるのもそこ。
