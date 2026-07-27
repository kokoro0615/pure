# HiiIbizaCenteredMenu Specification

## Overview
- Target file: `src/components/Hero.tsx`
- Screenshot closed: `website/docs/design-references/hiibiza/menu-closed-desktop.png`
- Screenshot open: `website/docs/design-references/hiibiza/menu-open-desktop.png`
- Interaction model: click-driven open/close.

## DOM Structure
- Fixed frame spans viewport width.
- Shell maxes at 400px and contains:
  - top row with logo link and menu/close button.
  - expandable panel with uppercase nav links, horizontal preview cards, footer links.

## Extracted Hï Ibiza Styles

### Frame
- position: fixed
- top: 0px
- width: 1440px
- height: 88px
- display: flex
- justify-content: center
- padding: 16px
- z-index: 50
- pointer-events: none

### Closed Shell
- x/y/w/h at 1440: `520,16,400,56`
- x/y/w/h at 390: `16,16,358,56`
- display: flex
- flex-direction: column
- max-width: 400px
- width: 100%
- height: 56px
- background: rgb(255, 255, 255)
- border-radius: 28px
- overflow: hidden
- color: oklch(0.371 0 0)
- font-family: "Magic UI Pro", sans-serif

### Top Row
- display: flex
- justify-content: space-between
- padding: 4px
- height: 56px

### Logo Link
- x/y/w/h desktop: `524,20,134,48`
- display: flex
- padding: 12px 17.25px
- border-radius: 9999px
- font-size: 16px
- font-weight: 500
- line-height: 24px

### Button
- x/y/w/h desktop: `839,20,77,48`
- display: flex
- padding: 12px 17.25px
- border-radius: 9999px
- background: oklab(0 0 0 / 0.12)
- font-size: 16px
- font-weight: 500
- line-height: 24px
- color: oklch(0.205 0 0)
- transition: color/background/border/fill/stroke 150ms cubic-bezier(0.4, 0, 0.2, 1)

## Open State
- shell background: rgb(0, 0, 0)
- shell color: oklch(0.922 0 0)
- shell height at 900px viewport: 868px
- panel rect starts y=72 and height=812
- panel padding: 64px 0px 32px
- panel overflow-y: auto

### Open Links
- text: Events, Artists, News, Music, VIP Tables, Art, About, Store
- font-size: 44px
- line-height: 44px
- text-transform: uppercase
- color: oklch(0.556 0 0)
- hover color: oklch(0.922 0 0)
- transition: 200ms

## Adaptation Notes
- The PURE implementation preserves the extracted dimensions, spacing, click model, colors, and open/closed structure.
- The left logo uses the local PURE Osaka graffiti asset instead of the Hï Ibiza SVG so the cloned bar fits the current client site.
