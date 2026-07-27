# ClubRaiaAllPanel Specification

## Overview
- Target: `src/components/ClubRaiaAllPanel.tsx` and CSS module.
- Screenshot: `docs/design-references/clubraia/nav-original-desktop-all.png`.
- Interaction: click-open with hover previews. The source's dormant pointer-Y handler did not move the list during the live sweep, so the local implementation adds native panel scrolling to keep every destination reachable.

## DOM
- fixed full-viewport panel
- radial vignette
- 80vw centered wrapper
- vertically stacked navigation items with real local image per item

## Exact styles
- panel: fixed inset 0, 100vw×100vh, `#14181b`, z-index 90, horizontal overflow hidden, vertical overflow auto, hidden scrollbar, overscroll contained, initial opacity 0, pointer-events none.
- vignette: fixed inset 0, z-index 98, radial-gradient(circle, transparent 36%, black 96%), pointer-events none.
- center: relative, left 50%, translateX(-50%), width 80vw, min-height 100%.
- list: relative, width 100%, padding `40vh 0 50vh`, white-space nowrap. Its normal flow creates the panel's scroll range without moving the initial first-item position.
- item: Playfair Display 54px/2.3, uppercase, padding-left 15px.
- link: centered block, padding 0 30px, 15px tracking, rgba(255,255,255,.3), transition color .6s; hover white.
- 1440×1000 item height 124.19px; first item y=400.

## States/behavior
- enter panel opacity in .7s after .3s.
- each item enters y=200/scaleY=1.3/opacity 0 to rest over 1.3s, delay .6, .08 stagger.
- list remains at its extracted position during hover and moves only through native wheel, trackpad, touch, or keyboard scrolling.
- at 1440×1000 the panel measures 1645px scroll height with a 645px range; reopening resets scrollTop to 0.
- hovered item reveals its local image and brightens the label.
- exit items y=100/opacity 0 over .5s, -.03 stagger; panel fades after .3s.

## Content/assets
- Home → `/`, `/clubraia/slide06.jpg`
- The Great Gatsby → `#the-great-gatsby`, `/clubraia/slide01.jpg`
- The Suites → `#the-suites`, `/clubraia/slide02.jpg`
- Concept → `#concept`, `/clubraia/slide04.jpg`
- F&B → `#fnb`, `/clubraia/slide05.jpg`
- Events → `#events`, `/clubraia/slide07.jpg`

## Responsive
- source trigger hidden at <=812px. Panel still guards narrow layouts: horizontal overflow, list padding 10vh 0, item 34px, 20px left margin, 15px bottom margin.
