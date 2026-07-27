# ClubRaiaHero Specification

## Overview
- **Target file:** `src/components/Hero.tsx`
- **Source screenshots:**
  - `docs/design-references/clubraia/original-hero-desktop-loading.png`
  - `docs/design-references/clubraia/original-hero-desktop-open.png`
  - `docs/design-references/clubraia/original-hero-mobile-open.png`
- **Local verification screenshots:**
  - `docs/design-references/clubraia/local-hero-desktop-open.png`
  - `docs/design-references/clubraia/local-hero-mobile-open.png`
- **Interaction model:** click-driven and wheel-driven slider, with click-driven loading intro.

## DOM Structure
- `section.clubraia-hero`
  - hidden SVG clipPath definitions for desktop and mobile hexagons
  - fixed `header.clubraia-header`
  - `div.clubraia-loading` intro overlay
  - `div.clubraia-bg-track` full-viewport slide images
  - `div.clubraia-vignette`
  - `div.clubraia-mask-track` clipped hexagon slide images
  - `svg.clubraia-progress-line` and `svg.clubraia-progress-bar`
  - mobile equivalents of progress SVGs
  - `div.q-container.hero-slider-content` containing stacked `.slider-content` title links
  - `nav.clubraia-slider-navigation`
  - mobile-only `div.clubraia-slider-number`

## Computed Styles From Source

### Body / page
- background-color: `#0B0B0D`
- color: `#F8F3E7`
- font-family: `'Lora', serif`
- font-size: `14px`
- line-height: `1.8`

### Header
- position: `fixed`
- width: `100%`
- top: `0`
- z-index: `99`
- padding-top: `30px`
- font-family: `'Open Sans', sans-serif`
- overlay: `linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.3) 100%)`, height `200px`
- right links: position `absolute`, right `10%`, display `flex`, align-items `center`, justify-content `flex-end`, width `40%`, height `60px`

### Loading Intro
- position: `fixed`
- inset: `0`
- background: `#0B0B0D`
- z-index: `99` in source, raised to `100` to sit above local header
- font-family: `'Open Sans', sans-serif`
- logo width: `150px`, centered at `top: 50%`, transform `translateY(-30%) translateX(-50%)`
- enter block: uppercase, letter-spacing `10px`, centered at `top: 50%`
- `h1`: font-size `56px`, letter-spacing `24px`, line-height `60px`, margin-bottom `50px`
- tagline: font-size `20px`, letter-spacing `24px`, line-height `3`
- explore: font-size `12px`, letter-spacing `7px`, uppercase, underline grows on hover
- mobile `h1`: `38px`, letter-spacing `12px`

### Hero Slider
- height: `100vh`
- width: `100vw`
- position: `relative`
- padding: `0`
- text-align: `center`
- overflow: `hidden`

### Background Images
- container: position `absolute`, width `100%`, height `100%`
- slide: position `absolute`, width `100%`, height `100%`, background `#000`, overflow `hidden`
- image: position `absolute`, inset `0`, background-size `cover`, background-position `center`, opacity `.8`

### Mask Slider
- clip-path: `url(#slideMask)`
- width: `1280px`
- height: `776px`
- left: `50%`
- top: `50%`
- transform: `translateX(-50%) translateY(-50%)`
- mobile: clip-path `url(#slideMaskMobile)`, width `375px`, height `667px`
- mask slide transform: `scale(1.2)`
- mask overlay: white, mix-blend-mode `overlay`, opacity `0`

### Progress
- position: `absolute`, left `50%`, top `50%`, transform centered
- SVG: fill `none`, stroke `white`, stroke-width `1.5px`
- desktop line size: `1280px x 776px`, dasharray `1465`, initial dashoffset `139%`
- mobile line size: `375px x 667px`, dasharray `850`, initial dashoffset `131%`
- progress bar uses `mix-blend-mode: overlay`

### Title
- title link: display `block`, width `100%`, max-width `800px`, position `fixed`, left `50%`, top `50vh`, z-index `9999`, transform `translateX(-50%) translateY(-15%)`
- `h2`: font-size `3.8vw`, letter-spacing `1.2vw`, padding-left `24px`, line-height `60px`, uppercase, color `#fff`, transition `letter-spacing 1s cubic-bezier(0.19, 0.77, 0.28, 0.9)`
- active hover `h2`: letter-spacing `1.6vw`
- `h6`: Open Sans, font-size `12px`, letter-spacing `7px`, font-weight `400`, uppercase, margin-top `70px`, underline width `0 -> 100%`
- mobile `h2`: font-size `32px`, letter-spacing `10px`, padding-left `10px`, line-height `1.5`
- mobile `h6`: margin-top `30px`

### Navigation
- item: position `absolute`, top `50%`, width `135px`, height `80px`, padding `10px`, transform `translateY(-50%)`, transition `all .3s cubic-bezier(0.19, 0.77, 0.28, 0.9)`
- next: right `5%`
- prev: left `5%`
- line: top `50%`, height `1px`, width `70%`, background `#fff`, opacity `.5`
- hover width: `200px`, translate next `+30px`, prev `-30px`, line opacity `1`
- mobile: width `80px`, bottom `75px`, top reset

## Text Content
- Loading: `Club Raia`
- Loading tagline: `Best Nightlife Experience`
- Loading CTA: `Click to Explore`
- Slides: `The Great Gatsby`, `The Suites`, `Concept`, `F&B`, `Events`, `About Raia`
- Slide CTA: `Explore`
- Header links: `+ all`, `about`, `contact`

## Assets
- `/clubraia/logo.svg`
- `/clubraia/arrowleft.svg`
- `/clubraia/arrowright.svg`
- `/clubraia/slide01.jpg`
- `/clubraia/slide02.jpg`
- `/clubraia/slide04.jpg`
- `/clubraia/slide05.jpg`
- `/clubraia/slide07.jpg`
- `/clubraia/slide08.jpg`
