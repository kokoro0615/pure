# PURE Page Topology with Club Raia Menu

1. `ClubRaiaMenu` — fixed layer, z-index 99
   - Centered 50px Raia logo.
   - Desktop right controls: `+ all`, `about`, `contact`.
   - Mobile right control: `contact` only.
   - When open, replaces controls with panel-specific `Close — ×`.

2. `ClubRaiaAllPanel` — fixed overlay, z-index 90
   - Click-driven, full viewport.
   - Six real page labels with pointer-position-driven vertical movement.
   - Hover-driven image preview and text color transition.

3. `ClubRaiaInfoPanel` — fixed overlay, z-index 90
   - Shared layout for About and Contact.
   - Click-driven right-to-left reveal.
   - Background-image zoom, title reveal, and copy mask reveal.

4. Existing PURE hero, intro, videos, wordmark, and carousel
   - Preserved as the page content underneath.
   - Scales to 0.9 and receives a 50% black overlay while any menu panel is open.

Dependencies: `ClubRaiaMenu` owns the active-panel state and imports both panel components. The panels do not modify carousel state.
