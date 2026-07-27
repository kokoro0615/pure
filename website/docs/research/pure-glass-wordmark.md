# PURE Glass Wordmark Notes

## Goal
- Convert the Club Raia-style hexagonal glass focal object into a PURE text glass focal object.
- Preserve the original hero role: centered refractive focus, slide-synchronized imagery, progress feedback, hover emphasis, and responsive composition.

## Design Decisions
- Replace the hexagon mask and polygon progress with `.pure-glass-wordmark`.
- Use inline SVG for the wordmark so the text can behave like the original Raia glass object instead of ordinary white text.
- Clip the active slide image into the `PURE` letterforms with `clipPath`, then pass that clipped image through `feTurbulence` + `feDisplacementMap` to create a refracted copy of the background.
- Render separate layers for shadow, dark glass body, luminous edge stroke, diagonal sheen, and facet overlays.
- Drive the former polygon progress role through the thin `.pure-glass-meter` line using `--pure-glass-progress`.
- Move the slide title into a smaller navigation label below the wordmark so `PURE` remains the dominant visual object.
- Switch the first slide to the warmer VIP Lounge image because it gives the glass text stronger contrast and a less one-note color field than the purple system wall.

## Root Cause of Previous Mismatch
- The previous implementation used CSS text clipping and bright white gradients, so it read as white typography rather than a glass object.
- It lacked the source site's key structure: a separate image layer clipped into the shape, darker transparent surface, overlay facets, and a thin structural outline.
- The local dev server was also serving an older CSS bundle during one validation pass; after restart, the SVG rules applied correctly.

## Verification Captures
- Desktop: `docs/design-references/clubraia/pure-glass-word-desktop.png`
- Mobile: `docs/design-references/clubraia/pure-glass-word-mobile.png`
- Reference: `docs/design-references/clubraia/raia-hex-glass-reference.png`
- Improved desktop: `docs/design-references/clubraia/pure-glass-refracted-desktop.png`
- Improved mobile: `docs/design-references/clubraia/pure-glass-refracted-mobile.png`
