# TheCrossContact SEND Specification

## Overview

- **Target file:** `src/components/TheCrossContact.tsx`
- **Styles:** `src/app/globals.css`
- **Desktop screenshot:** `docs/design-references/the-cross-talk-to-us-desktop.png`
- **Mobile screenshot:** `docs/design-references/the-cross-talk-to-us-mobile.png`
- **Interaction model:** form submit + pointer hover
- **Reference URL:** `https://the-cross-2023.webflow.io/`, TALK TO US overlay

## DOM Structure

The submit control is a right-floated flex wrapper containing the SEND submit
control followed immediately by the 24 × 17 arrow SVG. The whole wrapper is the
hover target so moving across either the word or arrow preserves the animation.

## Computed Styles (exact values from getComputedStyle)

### Desktop wrapper at 1440 × 1000

- display: `flex`
- alignItems: `center`
- justifyContent: `flex-end`
- float: `right`
- width: `102.546875px`
- height: `48.53125px`
- marginTop: `8.48332px`
- cursor: `crosshair`

### Desktop SEND control

- fontFamily: `Migra, sans-serif`
- fontSize: `20.36px`
- fontWeight: `400`
- lineHeight: `30.5399px`
- color: `rgb(37, 42, 46)`
- backgroundColor: `rgba(0, 0, 0, 0)`
- padding: `9px 15px`
- width: `78.546875px`
- height: `48.53125px`
- border: `0`

### Arrow

- asset: `public/the-cross/arrow.svg`
- width: `24px`
- height: `17px`
- default transform: `translate3d(0, 0, 0)`

### Mobile wrapper at 390 × 844

- width: `96.390625px`
- height: `44.671875px`
- marginTop: `7.40776px`
- right edge: `351.78125px` (22.21875px from the white panel edge)

### Mobile SEND control

- fontFamily: `Migra, sans-serif`
- fontSize: `17.7786px`
- lineHeight: `26.6679px`
- padding: `9px 15px`
- width: `72.390625px`
- height: `44.671875px`

## States & Behaviors

### Hover

- **Trigger:** pointer enters the wrapper or either child.
- **Before:** arrow transform `translate3d(0px, 0px, 0px)`.
- **After:** arrow transform `translate3d(6px, 0px, 0px)`.
- **Implementation:** CSS transform transition using the existing smooth
  interaction easing; text color and background do not change.

### Submit

- Required recipient: `pureosaka2005@gmail.com`.
- With no mail API or server integration in the repository, submit opens the
  visitor's configured mail client using a `mailto:` URL.
- Subject contains the selected enquiry topic.
- Body contains full name, reply email, enquiry topic, and message.
- Keep native required-field validation.

## Assets

- `public/the-cross/arrow.svg` (existing; exact 24 × 17 source asset)
- No new images, videos, fonts, or SVGs are required.

## Text Content (verbatim)

- `SEND`

## Responsive Behavior

- **Desktop (1440px):** submit wrapper aligns to the form's right edge below the
  message underline.
- **Tablet:** the contact overlay must scroll vertically whenever its content is
  taller than the viewport; the SEND control must remain reachable.
- **Mobile (390px):** wrapper remains right aligned and uses the smaller computed
  font metrics above. The overlay is vertically scrollable and the SEND control
  appears immediately after the message field.
