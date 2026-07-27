# TheCrossContact Specification

## Overview

- **Target file:** `website/src/components/TheCrossContact.tsx`
- **Screenshot:** `docs/design-references/the-cross-2023.webflow.io/contact-desktop.png`
- **Interaction model:** click-driven form controls; static local contact page

## DOM Structure

`main.contact-page > section.contact-panel > button.close > img`, then a two-column grid. The left grid item contains three display lines and the address link. The right item contains name, email, enquiry select, message textarea, a submit row and reservation note.

## Computed Styles (desktop, 1440 × 1000)

### Panel

- fixed lower-right overlay; width `98vw`, height `96vh`, background `#fff`, z-index `16`
- desktop padding `98px 98px 98px 4rem`; observed open state is `left: 28.8125px; top: 40px`
- base font `UniversLTPro`, `14.8458px/22.2687px`, color `rgb(51,51,51)`

### Grid

- `display: grid`, `width/height: 100%`, `grid-template-columns: 1fr 1fr`, gap `30px`
- desktop observed columns `607.656px 607.672px`

### Display heading

- `Migra`, weight 400, `101.8px/101.8px`, uppercase, color `#333`
- desktop first line left inset is 40px, with `push-small` and `push-md` line offsets that produce the stepped wordmark.

### Form

- starts at approximately the grid's vertical center (`top: 432.66px` in capture)
- fields: `height:60px`, margin bottom `16.9666px`, padding `16px 12px 16px 0`, font `UniversLTPro 15.27px/21.8142px`, uppercase, background white, only `border-bottom: 1px solid rgba(37,42,46,.4)`
- message height `120px`
- submit: `Migra 20.36px/30.54px`, transparent, uppercase. Arrow is `24px` wide.
- close: `48px` circle, `1px solid rgba(37,42,46,.2)`, positioned `2rem` from upper-left; cross icon 15px.

## States & Behaviors

- **Open transition (reference):** Webflow moves the panel from `translateY(100vh) rotateZ(-5deg)` to identity. Implement a short page-load equivalent only if it does not hide content for screenshots.
- **Input hover:** bottom border `rgba(37,42,46,.4)` → `#dfbd69`.
- **Input focus:** bottom border → `#e27469`, outline removed.
- **Submit:** prevent navigation; show an inline success acknowledgement.

## Assets

- `website/public/the-cross/close.svg`
- `website/public/the-cross/arrow.svg`
- `website/public/the-cross/Migra-Regular.ttf`
- `website/public/the-cross/UniversLTPro55Roman.ttf`

## Text Content (verbatim)

`TALK` / `TO` / `US.`

`2-4, Wharfdale Rd` / `N1 9RY`

`NAME`, `EMAIL`, `ENQUIRY TYPE`, `YOUR MESSAGE...`, `SEND`

Enquiry options: `Enquiry type`, `Food & Drink`, `Private Hire`, `General enquiry`.

`For Restaurant reservations please book through the Reservations link in the menu bar.`

## Responsive Behavior

- **Desktop 1440px:** two equal columns; address absolute at lower-left; form vertically centered in right column.
- **Tablet:** one-column grid.
- **Mobile 390px:** panel `98vw × 93vh`, `padding: 120px 1.5rem 60px`; scrollable; heading `64px/64px`; address follows heading; form follows below. Close is `48px` at `top: 3rem; left: 1rem`.
