# Ushuaia Intro Recreation Research

Date: 2026-05-17
Target: https://www.theushuaiaexperience.com/en/club
Scope: opening 5-8 seconds and first scroll transition.

## Observation Summary

- The first viewport is a dark, high-contrast club header with fixed navigation above a video-led TV/monitor pull-in.
- The hero uses a `mux-player` element with `playback-id="PBDI9vqnjY4st3uS00FL1vlpLNxf3QOSqLVRJuvKnFEM"`, muted and looped, filling the header.
- A full viewport canvas sits behind the hero: `canvas.absolute.inset-0.bg-black.-z-10`.
- Network inspection confirmed bundled assets for `lottie-web`, `gsap`, `ScrollTrigger`, `@mux/mux-player`, a Lottie background JSON, and 60 PNG frames at `/visuals/frames/001.png` through `/visuals/frames/060.png`.
- The source bundle exposes a background module with `loadingText: "0%"`, `breakFrame: 70`, `endFrame: 70`, `playhead.frame`, and `colibri.frame`.
- Scroll from the page top to the first section scrubs a GSAP timeline. In page mode, the canvas focal center is biased upward, around `vh / 10`, while a 60-frame sequence advances and scales down to roughly `0.75` with `power2.out`.

## Timing Table

| Time | Observed State | Recreation Mapping |
| --- | --- | --- |
| 0.0s | Loader begins at `0%`; black field and signal texture establish the scene. | `IntroSequence` initializes loader state at `0%`, Canvas draws low-frequency scanlines and dot noise. |
| 0.8-1.4s | Loader completes; TV/monitor material becomes the focal object. | GSAP boot timeline finishes loader, then releases `--intro-progress` after a short overlap. |
| 1.4-4.5s | Accelerating camera push toward the screen; TV border and video plane grow with subtle tilt. | CSS 3D `translateZ`, scale, rotateX, and rotateZ are driven by a single progress value. |
| 3.0-5.5s | Screen material intensifies; scanlines/RGB dots remain visible; frame starts to disappear. | `TvTunnel` swaps local PURE photos rapidly and fades the frame pseudo-element. |
| 5.5-7.0s | Viewer enters the screen; the video becomes full-frame and connects to the page body. | Final local PURE signage frame fills the viewport, then `HeroAfterIntro` continues the same club signal aesthetic. |
| Scroll | The intro state is scrubbed/corrected while moving toward the next section. | ScrollTrigger uses `scrub: 0.55` from intro top to bottom; auto-play progress remains monotonic. |

## Layer Breakdown

- Loader: numeric `0%` to `100%`, high-contrast text, thin signal line, then fade.
- Navigation: fixed-feeling overlay with PURE mark, section links, red CTA, replay, menu icon.
- TV/monitor plane: CSS 3D stage, distant Z position, thick dark frame, rounded screen, specular bloom.
- Screen feed: local PURE photos from `image/`, fast image switching, final full-screen signage frame.
- Supplementary suction: poster/photo cards orbit outside the screen and collapse toward the center as progress rises.
- Signal layer: Canvas 2D scanlines, RGB dot matrix, moving white glitch band, red/cyan gradients.
- Texture layer: CSS grid floor, vignette, RGB split, screen scanline overlays.

## Technology Inference

- Confirmed: Mux player, GSAP, ScrollTrigger, Lottie, Canvas 2D, image frame sequence.
- Likely role of Mux: the hero TV pull-in is a rendered video asset rather than pure DOM animation.
- Likely role of Lottie: background curtain/noise frame control around `breakFrame`.
- Likely role of Canvas: 60-frame visual sequence called `colibri`, drawn centered and scroll-scrubbed.
- Local recreation avoids copying upstream media or logos; it reuses only the observed motion model and structural layering.

## Implementation Notes

- Added a Next.js App Router recreation with `IntroSequence`, `SignalCanvas`, `TvTunnel`, `HeroAfterIntro`, and `lib/intro-timeline`.
- `public/images` is a local symlink to the repository `image/` directory so Next can serve the provided PURE assets without external CDNs.
- GSAP is dynamically imported on the client; if unavailable, a `requestAnimationFrame` fallback preserves the core intro.
- `prefers-reduced-motion: reduce` skips the camera travel and presents the completed state.
- Replay resets scroll to top and restarts loader/camera progress.

## Gaps For Closer Matching

- Exact frame parity would require a bespoke rendered replacement video or an approved local frame sequence that matches the original Mux asset's camera path.
- The upstream TV shell has physically rendered bevels, reflections, and lighting. The current implementation approximates those with CSS shadows and pseudo-elements.
- Audio-reactive light pulses, if desired, would require a local audio source and an analyser-driven Canvas pass.
