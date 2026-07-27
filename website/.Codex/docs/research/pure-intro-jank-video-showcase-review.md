# PURE intro jank and video showcase review

Date: 2026-05-17

## Scope

- Target: `http://localhost:51794/`
- Focus: intro motion smoothness, post-intro video section, local video asset handling.
- Required videos:
  - `image/06_videos/video-001-halloween.mp4`
  - `image/06_videos/video-002-pure-osaka-20th-after-party.mp4`
  - `image/06_videos/video-003-pure-countdown-2026.mp4`

## Asset findings

The three source videos are 2160 x 3840 vertical H.264 files. They are suitable as masters, but too heavy for immediate browser playback in an animated landing page.

| Asset | Duration | Size / bitrate risk |
| --- | ---: | --- |
| `video-001-halloween.mp4` | ~71s | ~424MB, ~50Mbps |
| `video-002-pure-osaka-20th-after-party.mp4` | ~57s | ~135MB, ~20Mbps |
| `video-003-pure-countdown-2026.mp4` | ~55s | ~323MB, ~49Mbps |

Optimized 720p display derivatives and posters were generated under:

- `image/06_videos/optimized/*.mp4`
- `image/06_videos/posters/*.jpg`

## Root causes

1. `SignalCanvas` painted a full-screen RGB dot matrix with nested loops. At desktop sizes this produced tens of thousands of `fillRect` calls per frame and competed with GSAP/CSS 3D animation.
2. `TvTunnel` continued a `requestAnimationFrame` loop even after the intro was effectively finished, so it kept forcing style updates while the page had already moved into normal content.
3. The loader text was updated through React state on every GSAP tick. That caused avoidable React renders during the most sensitive first second.
4. A video element with source metadata attached too early can trigger large range requests against the original 4K MP4 files. In one browser check this caused the page to hang/crash before the video section was visible.

## Fixes applied

- Capped canvas DPR and replaced the dense RGB matrix with bounded speck/noise drawing.
- Throttled canvas paints to about 20fps during the intro and much lower after completion.
- Made `TvTunnel` idle after intro completion instead of running a permanent per-frame loop.
- Moved loader percentage updates to a DOM ref, avoiding React state churn during the loader.
- Added `VideoShowcase` as a post-intro section using the three local videos through optimized derivatives.
- Deferred video `src` attachment with `IntersectionObserver`; only the active reel loads when the section enters the viewport.
- Kept inactive reels as poster cards to preserve the designed UI without downloading all videos.
- Added mobile and reduced-motion CSS behavior.

## Verification

- `npm run build`: passed.
- Browser check at `http://localhost:51794/`: page loaded.
- Console errors during checked flows: none observed.
- Image/video network checks: posters returned `200`; active optimized video returned `206 Partial Content`; no image/video `404` observed.
- Desktop and mobile screenshots were saved through browser verification.

## Remaining production gap

The raw videos should remain source masters. For production-grade delivery, use adaptive HLS/DASH or a Mux-style pipeline with multiple renditions, poster extraction, and bandwidth-aware autoplay. The current 720p derivatives are a local, static approximation that removes the visible jank risk in this repo.
