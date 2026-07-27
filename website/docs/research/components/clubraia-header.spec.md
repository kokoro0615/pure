# ClubRaiaMenu Specification

## Overview
- Target: `src/components/ClubRaiaMenu.tsx` and CSS module.
- Screenshot: `docs/design-references/clubraia/nav-original-desktop-closed.png`.
- Interaction: click-driven panel owner; Escape closes.

## DOM
- fixed header with 200px transparent-to-black overlay
- centered linked Raia logo
- right flex controls
- three dormant close controls, one active while a panel is open
- global dim layer behind the active panel

## Exact styles
- header: fixed top 0, width 100%, padding-top 30px, z-index 99, Open Sans.
- logo: absolute left 50%, translateX(-50%), width 50px; mobile 45px.
- right group: absolute right 10%, width 40%, height 60px, flex end/center.
- links: 11px/19.8px, 3px tracking, uppercase, margin-left 50px, cream `#f8f3e7`.
- desktop at 1440: +all x=1030.92, about x=1123.52, contact x=1225.22; y=50.09.
- close: absolute right 0, 11px/19.8px, initial y=30/opacity 0; active y=0/opacity 1.
- close line: 65×1, margin `5px 12px 0 20px`; mobile 15px wide with zero horizontal margin.
- close icon: 17×16 desktop, 13px mobile.
- content overlay: fixed inset 0, rgba(0,0,0,.5), opacity 0, z-index below panels.

## States
- open: nav links y `0→-30`, opacity `1→0`, 0.6s, delay .5, .05 stagger.
- close enters y `30→0`, opacity `0→1`, .6s, delay 1s; line/icon delays 1.1/1.2s.
- close reverses immediately; main layer returns after .4s.

## Responsive
- breakpoint `max-width:812px`.
- hide +all and about; contact remains.
- preserve centered logo and right-aligned contact.

## Assets/text
- `/clubraia/logo.svg`, `/clubraia/close.svg`.
- `+ all`, `about`, `contact`, `Close`.
