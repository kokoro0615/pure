/**
 * The mark that rides on a call to action: a rule with an arrowhead.
 *
 * Not an arrow inside a circle. The circled diagonal arrow was on every
 * button on the site and belongs to no one; the hero's own previous/next
 * controls have always been a hairline plus an arrow, so the rule is the
 * gesture this building already uses. It extends on hover instead of
 * spinning, which is the same "the light travels" idea as the plate.
 *
 * The rule carries `data-rule` so the stylesheet can scale it on its own
 * origin without a second wrapper.
 */
export function CtaMark() {
  return (
    <svg
      className="pure-cta__mark"
      viewBox="0 0 28 10"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        data-rule=""
        d="M0 5h19"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <path
        d="m22 1 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
