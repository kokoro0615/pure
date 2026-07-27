# HERO Glass Text Handoff for Claude Code

このメモは、PURE Osaka の HERO 動画上に載っている透明ガラス風テキストを、別プロジェクトへ移植するための Claude Code 向け引き継ぎです。

## Claude Code にそのまま渡す依頼文

以下を別プロジェクトの Claude Code に渡してください。

```text
PURE Osaka サイトの HERO 動画上にある透明ガラス風ワードマークを、このプロジェクトへ移植してください。

元実装の場所:
- /home/kokoro/projects/clients/pure/website/src/components/Hero.tsx
  - スライド動画/ポスター定義: 21-40行目
  - activeSlideVideo / activeSlidePoster / glassStyle: 148-155行目
  - 背景動画レイヤー: 252-272行目
  - 透明ガラス文字の SVG: 276-363行目
- /home/kokoro/projects/clients/pure/website/src/app/globals.css
  - HERO 動画/オーバーレイ: 882-925行目
  - ガラス文字本体: 944-1073行目
  - モバイル調整: 1615-1635行目
- /home/kokoro/projects/clients/pure/website/src/app/layout.tsx
  - Playfair Display の font variable: 17-21行目、body への付与: 36行目

移植したい中心機能:
- 背景動画の上に、SVG の clipPath text で切り抜いた大きなワードマークを重ねる。
- 文字の中にも同じ動画を流し、feTurbulence + feDisplacementMap で屈折したガラス感を作る。
- その上に影、薄い白塗り、ゴールド混じりのストローク、sheen の太いハイライト線、facet パスを重ねる。
- 現在の実装ではワードは `PURE`。別プロジェクトでは必要な文字へ差し替えてよいが、長い文字の場合は viewBox/font-size/letter-spacing を調整する。

コピー対象アセット:
- /home/kokoro/projects/clients/pure/website/public/pure/videos/optimized/pure-countdown-2026.web.mp4
- /home/kokoro/projects/clients/pure/website/public/pure/videos/optimized/pure-halloween.web.mp4
- /home/kokoro/projects/clients/pure/website/public/pure/videos/optimized/pure-osaka-20th-afterpub.web.mp4
- /home/kokoro/projects/clients/pure/website/public/pure/posters/pure-countdown-2026.jpg
- /home/kokoro/projects/clients/pure/website/public/pure/posters/pure-halloween.jpg
- /home/kokoro/projects/clients/pure/website/public/pure/posters/pure-osaka-20th-afterpub.jpg

実装方針:
1. 既存プロジェクトの HERO コンポーネント内に、下の `GlassVideoWordmark` 相当を追加する。
2. 背景動画が既にある場合は、その active video/poster を `videoSrc` / `posterSrc` に渡す。
3. 背景動画がない場合は、同じ `videoSrc` を背景の `<video>` とガラス文字内部の `<video>` の両方に使う。
4. CSS は下の `.glass-video-wordmark` 系を追加し、必要に応じて className プレフィックスだけプロジェクトに合わせる。
5. `foreignObject` 内の video を使うため、Safari/iOS も実機または Playwright/WebKit で表示確認する。
6. `id` 衝突を避けるため、React では `useId()` を使って SVG filter/gradient/clipPath の id をインスタンスごとに一意にする。

完成後に確認すること:
- デスクトップで HERO 中央に大きい透明ガラス文字が表示される。
- 文字の中に動画が流れている。
- 背景動画、文字内動画、ポスターが 404 になっていない。
- モバイルで文字が画面幅からはみ出さない。
- `npm run lint` と `npm run build` が通る。
```

## 使いやすく切り出した React コンポーネント

元実装は `Hero.tsx` に直接書かれています。別プロジェクトへ移す場合は、この形に切り出すと扱いやすいです。

```tsx
"use client";

import { useId, type CSSProperties } from "react";

type GlassVideoWordmarkProps = {
  word?: string;
  videoSrc: string;
  posterSrc?: string;
  progress?: number;
  className?: string;
};

export function GlassVideoWordmark({
  word = "PURE",
  videoSrc,
  posterSrc,
  progress = 1,
  className = "",
}: GlassVideoWordmarkProps) {
  const rawId = useId().replaceAll(":", "");
  const filterId = `glassTextRefract-${rawId}`;
  const strokeId = `glassStroke-${rawId}`;
  const veilId = `glassVeil-${rawId}`;
  const clipId = `glassTextClip-${rawId}`;

  const style = {
    "--glass-progress": `${Math.max(0, Math.min(progress, 1)) * 100}%`,
  } as CSSProperties;

  return (
    <div className={`glass-video-wordmark ${className}`.trim()} style={style} aria-hidden="true">
      <svg className="glass-video-wordmark__svg" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id={filterId} x="-12%" y="-30%" width="124%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.055" numOctaves="2" seed="14" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.18" />
          </filter>

          <linearGradient id={strokeId} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="37%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="58%" stopColor="rgba(198,157,83,0.58)" />
            <stop offset="76%" stopColor="rgba(255,255,255,0.78)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.16)" />
          </linearGradient>

          <linearGradient id={veilId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="48%" stopColor="rgba(198,157,83,0.32)" />
            <stop offset="66%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </linearGradient>

          <clipPath id={clipId}>
            <text x="600" y="248" textAnchor="middle">{word}</text>
          </clipPath>
        </defs>

        <text className="glass-video-wordmark__shadow" x="600" y="248" textAnchor="middle">{word}</text>

        <g clipPath={`url(#${clipId})`} filter={`url(#${filterId})`}>
          <foreignObject className="glass-video-wordmark__video-wrap" x="-90" y="-76" width="1380" height="520">
            <video className="glass-video-wordmark__video" src={videoSrc} poster={posterSrc} autoPlay loop muted playsInline preload="auto" />
          </foreignObject>
          <rect className="glass-video-wordmark__dim" x="0" y="0" width="1200" height="340" fill={`url(#${veilId})`} />
          <path className="glass-video-wordmark__facet glass-video-wordmark__facet--a" d="M40 42 L470 0 L340 340 L0 340 Z" />
          <path className="glass-video-wordmark__facet glass-video-wordmark__facet--b" d="M385 0 L780 0 L650 340 L220 340 Z" />
          <path className="glass-video-wordmark__facet glass-video-wordmark__facet--c" d="M790 0 L1160 0 L1200 340 L712 340 Z" />
          <path className="glass-video-wordmark__facet glass-video-wordmark__facet--d" d="M120 104 L1040 28 L955 112 L170 184 Z" />
        </g>

        <text className="glass-video-wordmark__body" x="600" y="248" textAnchor="middle">{word}</text>
        <text className="glass-video-wordmark__edge" x="600" y="248" textAnchor="middle" stroke={`url(#${strokeId})`}>{word}</text>
        <text className="glass-video-wordmark__sheen" x="600" y="248" textAnchor="middle">{word}</text>
      </svg>

      <div className="glass-video-wordmark__meter"><span /></div>
    </div>
  );
}
```

## CSS

元の見た目に近い最小 CSS です。現在のプロジェクトでは `--raia-ease` と `--font-playfair` を使っていますが、下ではフォールバックを入れています。

```css
.glass-video-wordmark {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 4;
  width: min(86vw, 1160px);
  height: 330px;
  pointer-events: auto;
  transform: translateX(-50%) translateY(-47%);
  transition:
    filter 1s cubic-bezier(0.19, 0.77, 0.28, 0.9),
    transform 1.2s cubic-bezier(0.19, 0.77, 0.28, 0.9);
}

.glass-video-wordmark:hover {
  filter: brightness(1.08) contrast(1.05);
  transform: translateX(-50%) translateY(-48%) scale(1.025);
}

.glass-video-wordmark__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  font-family: var(--font-playfair), "Playfair Display", Georgia, serif;
}

.glass-video-wordmark__svg text,
.glass-video-wordmark__svg clipPath text {
  font-family: var(--font-playfair), "Playfair Display", Georgia, serif;
  font-size: 292px;
  font-weight: 700;
  letter-spacing: -4px;
}

.glass-video-wordmark__shadow {
  fill: rgba(0, 0, 0, 0.54);
  filter: blur(2.4px);
  transform: translateY(22px);
}

.glass-video-wordmark__video-wrap {
  overflow: hidden;
}

.glass-video-wordmark__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0.96;
  filter: saturate(1.35) contrast(1.24) brightness(1.08);
}

.glass-video-wordmark__dim {
  opacity: 0.34;
  mix-blend-mode: multiply;
}

.glass-video-wordmark__facet {
  mix-blend-mode: overlay;
}

.glass-video-wordmark__facet--a {
  fill: rgba(255, 255, 255, 0.28);
}

.glass-video-wordmark__facet--b {
  fill: rgba(0, 0, 0, 0.26);
}

.glass-video-wordmark__facet--c {
  fill: rgba(198, 157, 83, 0.3);
}

.glass-video-wordmark__facet--d {
  fill: rgba(255, 255, 255, 0.34);
  filter: blur(0.2px);
}

.glass-video-wordmark__body {
  fill: rgba(255, 255, 255, 0.09);
  stroke: rgba(0, 0, 0, 0.48);
  stroke-width: 8px;
  paint-order: stroke fill;
  mix-blend-mode: normal;
}

.glass-video-wordmark__edge {
  fill: transparent;
  stroke-width: 4.4px;
  paint-order: stroke;
  filter:
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.54))
    drop-shadow(0 0 16px rgba(72, 213, 255, 0.16))
    drop-shadow(0 18px 30px rgba(0, 0, 0, 0.6));
  opacity: 0.96;
}

.glass-video-wordmark__sheen {
  fill: transparent;
  stroke: rgba(255, 255, 255, 0.68);
  stroke-dasharray: 180 260;
  stroke-dashoffset: 96;
  stroke-width: 13px;
  filter: blur(0.45px);
  opacity: 0.64;
  mix-blend-mode: screen;
}

.glass-video-wordmark__meter {
  position: absolute;
  left: 50%;
  bottom: -18px;
  width: min(48vw, 460px);
  height: 1px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-50%);
}

.glass-video-wordmark__meter span {
  display: block;
  width: var(--glass-progress, 100%);
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.92), rgba(201, 159, 86, 0.72));
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.5);
  transition: width 1s cubic-bezier(0.19, 0.77, 0.28, 0.9);
}

@media (max-width: 767px) {
  .glass-video-wordmark {
    top: 43vh;
    width: 94vw;
    height: 172px;
    transform: translateX(-50%) translateY(-50%);
  }

  .glass-video-wordmark:hover {
    transform: translateX(-50%) translateY(-50%) scale(1.015);
  }

  .glass-video-wordmark__svg text,
  .glass-video-wordmark__svg clipPath text {
    font-size: 330px;
    letter-spacing: -4px;
  }

  .glass-video-wordmark__meter {
    bottom: -7px;
    width: 56vw;
  }
}
```

## 元プロジェクトでの使用例

`website/src/components/Hero.tsx` では、現在のスライドに合わせて次の値を渡しています。

```tsx
const progress = (activeIndex + 1) / slides.length;
const activeSlideVideo = slides[activeIndex].video;
const activeSlidePoster = slides[activeIndex].poster;

<GlassVideoWordmark
  word="PURE"
  videoSrc={activeSlideVideo}
  posterSrc={activeSlidePoster}
  progress={progress}
/>
```

## 注意点

- 文字が `PURE` より長い場合は、SVG の `viewBox`、`font-size`、`x="600"`、`foreignObject` の `x/width` を調整してください。
- Playfair Display を使うと元の印象に近くなります。Next.js なら `next/font/google` の `Playfair_Display` を使って `--font-playfair` を body に付けます。
- 動画ファイルは大きめです。元ファイルは 12MB、21MB、18MB なので、移植先では必要な分だけコピーしてください。
- `foreignObject` 内の `<video>` はブラウザ差が出やすいため、iOS Safari で必ず確認してください。
- 既存 HERO の z-index 構造に合わせ、背景動画より上、ナビや CTA より下に配置してください。
