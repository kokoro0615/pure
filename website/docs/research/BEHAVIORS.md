# Club Raia Header and Overlay Behavior Notes

## Source and scope

- URL: `https://www.clubraia.com/?s=i`
- Scope: fixed Raia logo, desktop `+ all / about / contact` controls, `Close — ×`, and the three click destinations.
- Browser automation: live Playwright inspection at 1440×1000, 768×1024, and 390×844.
- Master references: `docs/design-references/clubraia/nav-original-*.png`.
- Existing PURE intro, video hero, slide controls, and wordmark remain unchanged behind the cloned overlays.

## Interaction model

- The page has no document scroll (`scrollHeight === innerHeight`). All three controls are click-driven overlays.
- `+ all`, `about`, and `contact` have empty source `href` values; they do not navigate to a new URL.
- Opening any panel fades a fixed black `content-overlay` from `0` to `1` in `0.8s`, scales the hero to `0.9`, and moves all three header links to `translateY(-30px)` with opacity `0` over `0.6s`, delayed `0.5s`, staggered `0.05s`.
- The active close control moves from `translateY(30px)`/opacity `0` to rest/opacity `1` over `0.6s`, delayed `1s`. Its line grows to `65px` over `0.8s` at `1.1s`; the × icon scales in over `0.8s` at `1.2s`.
- Closing reverses the close control immediately, restores the links with a negative `0.05s` stagger, fades the overlay and returns hero scale to `1` after a `0.4s` delay.
- Escape should close the active local panel as an implementation-safe equivalent; the source exposes only click close.

## `+ all`

- Opens a fixed `#14181b` page with a radial black vignette.
- Six centered links: Home, The Great Gatsby, The Suites, Concept, F&B, Events.
- Desktop item links are Playfair Display 54px/124.2px, uppercase, 15px tracking, rgba(255,255,255,.3); hover transitions to white over `0.6s`.
- Items enter from `translateY(200px) scaleY(1.3)` and opacity `0` over `1.3s`, delay `0.6s`, stagger `0.08s`, Power4-out-like easing.
- The source script contains pointer-Y virtual-list code, but live inspection showed the list remains stationary because it initializes while hidden without a usable height. The clone reproduces the WebGL hover result with the real source images and adds native vertical panel scrolling so all six destinations remain reachable; reopening starts at the top.
- Closing fades the panel over `0.5s` after `0.3s`; items leave toward `translateY(100px)` over `0.5s` with `-0.03s` stagger.

## About

- Fixed right-origin panel expands width `0 → 100%` over `1s`, delayed `0.3s`, with Expo-in-out-like easing.
- Warm background `#1e1b14`; left image `/clubraia/about.jpg`; desktop picture rect at 1440×1000 is `0,270,720,560`.
- Image starts at scale `2`, settles to `1` over `3s`, delay `0.5s`, Expo-out-like easing.
- Desktop title `ABOUT RAIA`: Playfair Display 56px/60px, 24px tracking, 760×60, x=600/y=200. Each character rises from 100%, duration `1s`, delay `0.7s`, stagger `0.03s`.
- Copy mask animates from a zero mask to `linear-gradient(170deg,#000 60%,transparent 120%)` over `1s`, delay `0.7s`.

## Contact

- Same right-origin width and content animation as About.
- Cool background `#13171e`; `/clubraia/contact.jpg` is the real map graphic.
- Desktop title `CONTACT`: Playfair Display 50px/60px, 24px tracking, gold `#c39b54`, x=800/y=200.
- Address text is 18px/34px Lora, max-width 350px. Email, WhatsApp, and Google Maps are real links and underlined.

## Responsive behavior

- Breakpoint is exactly `max-width: 812px`.
- At 812px and below, `+ all` and `about` are `display:none`; `contact` remains visible. At 813px all three return.
- Mobile logo width is 45px (50px desktop), still centered at top 30px.
- Mobile info-panel image fills the viewport and is used as a 0.2-opacity background. Text becomes full-width with 10% side padding and starts at y=200.
- Mobile heading is 28px with 15px tracking, line-height 1.6, centered, margin-bottom 30px.
- The source CSS declares mobile body copy as 14px, but its contact-specific 18px rule has later/higher specificity and wins; computed contact copy remains 18px/34px.
- Mobile Close uses a 15px line and 13px × icon.

## Hover sweep

- Top-level `+ all / about / contact` computed text styles do not change on hover; the source relies on its custom cursor affordance.
- All-page list links transition color from rgba white `.3` to opaque white in `0.6s`.
- Contact text links remain underlined and retain the cream foreground color.

## Assets

- `/clubraia/logo.svg`, `/clubraia/close.svg`
- `/clubraia/about.jpg`, `/clubraia/contact.jpg`
- `/clubraia/slide01.jpg`, `slide02.jpg`, `slide04.jpg`, `slide05.jpg`, `slide06.jpg`, `slide07.jpg`
