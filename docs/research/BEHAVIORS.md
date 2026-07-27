# The Cross — Talk to us behaviors

- Canvas is a fixed white panel (`z-index: 16`); original is opened from the site navigation.
- Opening transition is Webflow-driven: `display: none` becomes flex, transform moves from `translateY(100vh) rotateZ(-5deg)` to identity.
- Close is a 48px circular control with a 15px cross SVG. It is hoverable (`cursor: crosshair`).
- Text fields are 60px tall, uppercase, with a 16px bottom gap. The message is 120px tall.
- The submit action is right-aligned and combines the Migra word `SEND` and a 24px arrow SVG.
- At tablet/mobile the grid becomes one column; the panel is scrollable and has a `93vh` height at 390px. The address becomes normal flow content below the display heading.
