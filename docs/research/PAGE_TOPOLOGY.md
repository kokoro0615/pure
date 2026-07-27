# The Cross — Talk to us topology

## Scope

The requested `talkToUs` view is a full-screen contact overlay opened from the **Talk to us** item on https://the-cross-2023.webflow.io/. It is not a standalone Webflow route.

## Visual hierarchy

1. White fixed contact canvas, anchored to the lower-right of the viewport (`98vw × 96vh`).
2. Circular close affordance at the canvas upper-left.
3. Two-column desktop grid:
   - Large three-line `TALK / TO / US.` display and an address link.
   - Contact form aligned near the lower half of the right column.
4. One-column, scrollable mobile layout; heading, address, then form.

## Interaction models

- Open: click-driven; original animates the canvas from `translateY(100vh) rotateZ(-5deg)` to its resting position.
- Close: click-driven; the requested local page remains open, so the close control is presentational and returns focus to the top.
- Fields: native form controls. Border changes `rgba(37,42,46,.4)` → `#dfbd69` on hover and `#e27469` on focus.
- Submit: local demo feedback only; no production form endpoint is cloned.
