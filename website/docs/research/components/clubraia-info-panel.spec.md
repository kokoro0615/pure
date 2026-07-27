# ClubRaiaInfoPanel Specification

## Overview
- Target: `src/components/ClubRaiaInfoPanel.tsx` and CSS module.
- Screenshots: `nav-original-desktop-about.png`, `nav-original-desktop-contact.png`, `nav-original-mobile-contact.png`.
- Interaction: click-open right-origin reveal; animation state supplied by parent.

## Shared desktop styles
- fixed inset `0 0 0 auto`, z-index 90, overflow hidden, width 0, display none until active.
- internal canvas: absolute top/right 0, width 100vw, height 100%.
- image wrapper: absolute left 0, width 50%, top calc(50% + 50px), translateY(-50%), height calc(100% - 200px), max-height 560px, overflow hidden.
- background: absolute inset 0, cover center; scale 2→1 over 3s after .5s.
- text: absolute left 50%, top 200px, width 50%, padding 0 80px, z-index 2.
- title: Playfair Display, uppercase, line-height 60px, 24px tracking, overflow hidden, margin-bottom 80px.
- copy: Lora 18px/34px, .5px tracking, margin-bottom 50px.
- copy mask: zero mask → `linear-gradient(170deg,#000 60%,transparent 120%)`, 1s after .7s.
- panel width: 0→100%, 1s after .3s, Expo-in-out-like easing.

## About
- background `#1e1b14`, image `/clubraia/about.jpg`.
- image rect 1440×1000: x0/y270/w720/h560.
- title x600/y200/w760/h60, 56px, margin-left -200px.
- body max-width 450px.
- verbatim copy: `Located in ELYSEE Mall at the heart of SCBD Jakarta, we are presenting to you the most Elegant KTV and Lounge for the best lifestyle experience. Strong lines, bold contrasts, and luxurious textures. We welcome you to take a moment to unwind with its welcoming atmosphere.`
- copyright: `© 2019 Raia. All Rights Reserved. Website by Fléava.` at 12px, rgba white .5.

## Contact
- background `#13171e`, image `/clubraia/contact.jpg`.
- title x800/y200/w560/h60, 50px, gold `#c39b54`, no negative margin.
- body max-width 350px.
- address: `ELYSEE SCBD Jakarta, 5th Floor, RT.7/RW.1, Senayan, Kec. Kby. Baru, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12190`.
- email `info@clubraia.com`; phone `(021) 50123199`; WhatsApp `+62 811-8691-223`; `View on Google Maps`.
- preserve mailto, wa.me, and Google Maps hrefs.

## Responsive <=812px
- panel may scroll vertically; image wrapper fills viewport, max-height none, opacity .2, positioned relative.
- text width 100%, left 0, top 200px, padding 0 10%.
- title 28px/1.6, 15px tracking, centered, padding 0 5%, margin-left 0, margin-bottom 30px, auto height.
- contact copy remains computed 18px/34px; width becomes available content width.
- `+ all` and About triggers are hidden; Contact remains fully accessible.
