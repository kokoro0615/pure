/**
 * The site's one "go to this room" mark: a diagonal arrow, drawn once.
 *
 * The menu tiles used the `↗` character, which is not in Univers and so was
 * resolved by whatever fallback the platform happened to offer, at a weight
 * that matched nothing else on the page. One authored path keeps the stroke
 * identical from the hero to the menu, and it rotates cleanly.
 */
export function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M7 17 17 7M9 7h8v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
