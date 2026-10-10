import "server-only";

/**
 * Client IP for abuse-bucket keying. Order:
 *   1. x-vercel-forwarded-for — asserted by the Vercel edge (overwrites
 *      client-supplied values).
 *   2. x-real-ip — asserted by the Vercel edge.
 *   3. x-forwarded-for right-most entry — the value the last trusted edge
 *      appended. The left-most entries are client-controllable; never use
 *      x-forwarded-for[0].
 *   Never trust cf-connecting-ip on Vercel: it is only meaningful when the
 *   hostname is verifiably behind Cloudflare proxy mode, which the runtime
 *   cannot prove; honoring it unconditionally makes every bucket
 *   client-keyed. If/when Cloudflare fronts the canonical host, the edge
 *   still asserts x-vercel-forwarded-for / x-real-ip first, so this stays
 *   correct.
 *   "unknown" keeps a single shared bucket (fail-visible, not fail-open).
 */
export function readIngressClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")
    ?.split(",").map((value) => value.trim()).filter(Boolean);
  if (vercel?.length) return bound(vercel[vercel.length - 1]);
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return bound(realIp);
  const xff = request.headers.get("x-forwarded-for")
    ?.split(",").map((value) => value.trim()).filter(Boolean);
  if (xff?.length) return bound(xff[xff.length - 1]);
  return "unknown";
}

function bound(value: string): string {
  return value.length > 0 && value.length <= 200 ? value : "unknown";
}
