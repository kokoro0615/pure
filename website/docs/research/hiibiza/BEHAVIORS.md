# Hï Ibiza Top Menu Behavior Notes

Scope: top centered menu bar on `https://www.hiibiza.com/`.

- Closed state is fixed at the top center with wrapper `position: fixed; top: 0; inset-x: 0; padding: 16px; z-index: 50; pointer-events: none`.
- Menu shell is `max-width: 400px`, full width below 432px viewport, `height: 56px`, `border-radius: 28px`, white background, hidden overflow.
- Inner row uses `display: flex; justify-content: space-between; padding: 4px`.
- Logo side is a 134x48 rounded link with 17.25px horizontal padding.
- Menu button is 77x48, rounded-full, black 12% background, 16px/24px medium sans text.
- Click on Menu switches shell background to black, button label to Close, logo to white, and expands shell height to nearly the viewport minus 32px.
- Open panel content starts below the 56px row with `padding: 64px 0 32px`, scrollable hidden scrollbar, centered uppercase links.
- Open menu links are uppercase, 44px font size at desktop, 44px line height, muted gray color changing to white on hover in 200ms.
- At 390px viewport, shell x is 16, width is 358, height remains 56 closed.
- No scroll-triggered style change was observed for the closed bar; it stays fixed.
