# Ushuaia Club Intro Animation Research

Date: 2026-05-17
Target: https://www.theushuaiaexperience.com/en/club

## Observed Structure

- The first viewport is a full-width `header` with a fixed visual field, top navigation, red CTA, and hamburger control.
- The first visible TV pull-in is delivered through a full-bleed `mux-player` custom element rather than a plain `<video>` tag.
- A lower background layer also uses an absolutely positioned `<canvas class="absolute inset-0 bg-black -z-10">` sized to the viewport.
- The visible look is a TV/newsprint collage: layered posters, scanline texture, RGB dot noise, and high contrast club imagery.
- The first content section begins below the viewport; scrolling from top to that section drives the intro state.

## Implementation Clues

- Main script: `https://www.theushuaiaexperience.com/build/assets/ushuaia-BNSaepLK.js`
- Main CSS: `https://www.theushuaiaexperience.com/build/assets/ushuaia-CMTTnRL8.css`
- Hero player: `<mux-player x-data="video" playback-id="PBDI9vqnjY4st3uS00FL1vlpLNxf3QOSqLVRJuvKnFEM" muted loop class="absolute top-0 left-0 w-full h-full z-10">`
- Libraries detected in the page bundle:
  - `@mux/mux-player`
  - `lottie-web`
  - `gsap`
  - `ScrollTrigger`
- The bundle defines a `background` Alpine data module with `breakFrame: 70`, `endFrame: 70`, `playhead.frame`, and `colibri`.
- The canvas image sequence loads 60 PNG files from `/visuals/frames/001.png` through `/visuals/frames/060.png`.
- The lottie curtain loads `/visuals/background_light.json` or `/visuals/background_dark.json` depending on the root theme.

## Motion Model

- Initial state: a distant CRT/TV-like screen appears in a dark space; nav and CTA sit above it.
- Hero video timing: roughly 0-1s distant TV, 1-4s accelerated push-in, 5-7s inside-screen transition. The camera move feels like `power2.out` into mostly linear travel.
- Scroll-linked state: GSAP timeline scrubs from body top to the first `section`.
- Canvas drawing state:
  - `colibri.frame` advances through the 60 PNG frame sequence.
  - `colibri.scale` moves from `1` to about `.75` with `power2.out`.
  - The image is drawn centered; in page mode the center y is near `vh / 10`, creating a top-biased logo/TV focal point.
- Lottie state:
  - `playhead.frame` moves toward `breakFrame` while scroll progresses.
  - The lottie animation supplies the curtain/noise/background transition layer.

## Local Recreation Strategy

- Keep the original architecture but remove external dependencies:
  - use a full-viewport hero
  - use DOM/CSS perspective layers for the TV pull-in
  - use one canvas for scanlines, dot texture, and signal noise
  - use local images from `image/` as the frame sources
  - use `requestAnimationFrame` and scroll progress instead of GSAP
- Because the original pull-in is video-material dependent, an exact frame-by-frame match requires the original Mux asset or a locally rendered replacement video. The current static implementation recreates the motion model and surface treatment without external video.
- Recreate the visual impression with:
  - a perspective TV frame
  - layered poster/photo planes
  - scanline and RGB-dot overlays
  - an automatic load animation that zooms into the central screen
  - scroll progress that continues the zoom/sink effect
- Add `prefers-reduced-motion` and a replay button for accessibility.
