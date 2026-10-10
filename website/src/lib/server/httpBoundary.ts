import "server-only";

/**
 * Shared HTTP request boundary helpers for public and admin API routes.
 *
 * The helpers here are deliberately framework-thin: they only read the
 * Fetch-standard `Request` object so the same boundary can guard App Router
 * handlers and any future signature-verified entrance. They do not depend on
 * request-derived headers (`Host`, `X-Forwarded-Host`, request `Origin`) for
 * canonical origin decisions; canonical origins always come from server
 * configuration.
 */

/** Sanity ceiling for a syntactically valid `Content-Length` declaration. */
const MAX_DECLARED_LENGTH_BYTES = 64 * 1024 * 1024;

export type HttpBodyErrorCode =
  | "body_too_large"
  | "declared_length_too_large"
  | "invalid_content_length"
  | "invalid_utf8"
  | "invalid_json"
  | "invalid_integer";

export class HttpBodyError extends Error {
  readonly code: HttpBodyErrorCode;

  constructor(code: HttpBodyErrorCode, message: string) {
    super(message);
    this.name = "HttpBodyError";
    this.code = code;
  }
}

export function isHttpBodyError(error: unknown): error is HttpBodyError {
  return error instanceof HttpBodyError;
}

/**
 * Reads a request body with a hard byte ceiling. When `Content-Length` is
 * declared it must be a sane non-negative integer and within `maxBytes`;
 * chunked/streamed bodies are counted while reading. Returns the exact raw
 * bytes, which signature-verified entrances need for HMAC validation.
 */
export async function readBoundedRawBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");

  if (declared !== null) {
    if (!/^\d{1,15}$/.test(declared.trim())) {
      throw new HttpBodyError("invalid_content_length", "Invalid Content-Length");
    }
    const declaredBytes = Number.parseInt(declared, 10);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_DECLARED_LENGTH_BYTES) {
      throw new HttpBodyError("invalid_content_length", "Invalid Content-Length");
    }
    if (declaredBytes > maxBytes) {
      throw new HttpBodyError("declared_length_too_large", "Request body too large");
    }
  }

  if (!request.body) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpBodyError("body_too_large", "Request body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Reads a bounded raw body and decodes it as strict UTF-8. */
export async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const raw = await readBoundedRawBody(request, maxBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new HttpBodyError("invalid_utf8", "Request body is not valid UTF-8");
  }
}

/** Reads a bounded JSON object body with fatal UTF-8 decoding. */
export async function readBoundedJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const text = await readBoundedText(request, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpBodyError("invalid_json", "Request body is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpBodyError("invalid_json", "Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export type BrowserMutationBoundaryError =
  | "origin_required"
  | "origin_mismatch"
  | "cross_site_blocked"
  | "unsupported_content_type";

export type BrowserMutationBoundary =
  | { ok: true }
  | { ok: false; status: number; error: BrowserMutationBoundaryError };

/**
 * Browser-mutation boundary for JSON POST routes.
 *
 * Fetch-metadata semantics:
 * - `Origin`, when present, must equal the request's own origin (the
 *   Vercel-routed host) or an explicitly allow-listed sibling origin. Browsers
 *   always send it on POST fetch/navigation, so every real cross-site browser
 *   context is rejected here.
 * - `Sec-Fetch-Site`, when present, must be `same-origin` or `none`.
 *   `cross-site` and `same-site` (sibling-subdomain) browser contexts are
 *   rejected even if they somehow omit `Origin`.
 * - `Content-Type` must be `application/json`, which additionally makes the
 *   request non-simple so browsers must preflight it, and blocks
 *   `text/plain`/form CSRF smuggling.
 * - A request with neither `Origin` nor `Sec-Fetch-Site` is a non-browser
 *   client (curl, server-side proxy, Playwright APIRequestContext). It is
 *   allowed: CSRF requires a victim browser, and browsers cannot omit both
 *   headers. Callers that also gate on a capability token or a
 *   SameSite=strict session cookie keep their existing authority checks.
 *
 * When `requireOrigin` is set, an absent `Origin` is rejected outright — for
 * surfaces whose only legitimate callers are same-origin browser fetch.
 */
export function assertSameOriginJsonMutation(
  request: Request,
  options: {
    allowedOrigins?: ReadonlySet<string>;
    requireOrigin?: boolean;
    requireJsonBody?: boolean;
  } = {},
): BrowserMutationBoundary {
  const selfOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (!origin && options.requireOrigin) {
    return { ok: false, status: 403, error: "origin_required" };
  }

  if (origin && origin !== selfOrigin && !(options.allowedOrigins?.has(origin) ?? false)) {
    return { ok: false, status: 403, error: "origin_mismatch" };
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { ok: false, status: 403, error: "cross_site_blocked" };
  }

  if (options.requireJsonBody !== false) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return { ok: false, status: 415, error: "unsupported_content_type" };
    }
  }

  return { ok: true };
}

const ADMIN_ORIGIN_ENV_KEYS = ["PURE_ADMIN_CONSOLE_ORIGIN", "NEXT_PUBLIC_ADMIN_ORIGIN"] as const;

/**
 * Parses the admin console origin allow-list from configuration. Admin cookie
 * sessions may legitimately be hosted on a sibling origin (the standalone VIP
 * Manager deployment), so the mutation boundary accepts the configured list
 * plus the request's own origin. Unknown/malformed values are ignored.
 */
export function readAdminAllowedOrigins(env = process.env): Set<string> {
  const origins = new Set<string>();
  const allowLocalHttp = env.VERCEL_ENV !== "production" && env.PURE_PROFILE !== "production";
  for (const key of ADMIN_ORIGIN_ENV_KEYS) {
    const raw = env[key];
    if (!raw) continue;
    for (const candidate of raw.split(",")) {
      try {
        origins.add(readCanonicalOrigin(candidate, { allowLocalHttp }));
      } catch {
        // Ignore malformed entries; fail closed by simply not allow-listing them.
      }
    }
  }
  return origins;
}

/**
 * Admin-cookie mutation boundary: browser requests must be same-origin or a
 * configured console origin. The admin session cookie is `SameSite=strict`;
 * this boundary is defense-in-depth layered on top.
 */
export function assertAdminCookieMutation(
  request: Request,
  options: { env?: NodeJS.ProcessEnv; requireJsonBody?: boolean } = {},
): BrowserMutationBoundary {
  return assertSameOriginJsonMutation(request, {
    allowedOrigins: readAdminAllowedOrigins(options.env ?? process.env),
    requireJsonBody: options.requireJsonBody,
  });
}

/** Public JSON mutation boundary: browser requests must be same-origin. */
export function assertPublicJsonMutation(request: Request): BrowserMutationBoundary {
  return assertSameOriginJsonMutation(request);
}

const CANONICAL_ORIGIN_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/u;

/**
 * Validates a configured canonical origin string. Rejects credentials,
 * paths, query strings, fragments, non-HTTPS origins (outside local dev),
 * and suffix-trick/embedded-userinfo forms.
 */
export function readCanonicalOrigin(
  value: string,
  options: { allowLocalHttp?: boolean } = {},
): string {
  const trimmed = value.trim();
  if (!CANONICAL_ORIGIN_PATTERN.test(trimmed)) {
    throw new Error("invalid_canonical_origin");
  }
  const parsed = new URL(trimmed);
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("invalid_canonical_origin");
  }
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (parsed.protocol !== "https:" && !(options.allowLocalHttp && parsed.protocol === "http:" && isLocalHost)) {
    throw new Error("invalid_canonical_origin");
  }
  return parsed.origin;
}

/**
 * Exact-origin check for browser-facing gates: HTTPS in every environment;
 * `http://localhost`/`127.0.0.1`/`[::1]` is additionally accepted outside
 * production profiles so the local dev server can exercise the same routes.
 */
export function isExactPublicOrigin(value: string, env = process.env): boolean {
  try {
    const parsed = new URL(value);
    if (
      parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
      || parsed.origin !== value
    ) {
      return false;
    }
    if (parsed.protocol === "https:") {
      return true;
    }
    const allowLocalHttp = env.VERCEL_ENV !== "production" && env.PURE_PROFILE !== "production";
    const isLocalHost =
      parsed.hostname === "localhost"
      || parsed.hostname === "127.0.0.1"
      || parsed.hostname === "[::1]";
    return allowLocalHttp && parsed.protocol === "http:" && isLocalHost;
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical public origin of the VIP booking surface.
 *
 * `PURE_BOOKING_PUBLIC_ORIGIN` is authoritative; the site-level fallbacks keep
 * single-surface deployments working. In production the configuration must
 * exist and must be a clean HTTPS origin — the resolver fails closed rather
 * than deriving the origin from request headers. Preview/development may fall
 * back to the request's own routed origin so disposable deployments keep
 * working without extra configuration.
 */
export function readVipBookingPublicOrigin(
  env = process.env,
  requestUrl?: string,
): string {
  const configured = env.PURE_BOOKING_PUBLIC_ORIGIN ?? env.NEXT_PUBLIC_SITE_URL ?? env.SITE_URL;
  const allowLocalHttp = env.VERCEL_ENV !== "production" && env.PURE_PROFILE !== "production";

  if (!configured) {
    if (allowLocalHttp && requestUrl) {
      try {
        return readCanonicalOrigin(new URL(requestUrl).origin, { allowLocalHttp: true });
      } catch {
        // fall through to the fail-closed error
      }
    }
    throw new Error("canonical_origin_missing");
  }

  return readCanonicalOrigin(configured, { allowLocalHttp });
}

const CLIENT_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;

/**
 * Reads a client-supplied request correlation ID for log correlation only.
 * The value is shape-checked and length-capped, and it must never be used as
 * a security/audit authority — audit request IDs are always server-generated.
 */
export function readClientCorrelationId(request: Request): string | null {
  const raw = request.headers.get("x-request-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  return CLIENT_CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Preflight check for signature-verified entrances: the signature header must
 * exist, stay under a sane length, and match `pattern` when provided. This
 * rejects unsigned junk before the body is consumed.
 */
export function readWebhookSignatureHeader(
  request: Request,
  headerName: string,
  pattern?: RegExp,
  maxLength = 4096,
): string | null {
  const value = request.headers.get(headerName);
  if (!value || value.length > maxLength) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || (pattern && !pattern.test(trimmed))) {
    return null;
  }
  return trimmed;
}

/**
 * Strict integer parser for URL/query input. Accepts only an exact decimal
 * representation within `[min, max]` — no exponent notation, decimals, signs
 * (unless `min < 0`), whitespace, or junk suffixes that `Number.parseInt`
 * would silently truncate.
 */
export function readStrictBoundedInteger(
  raw: string | null | undefined,
  options: { min: number; max: number },
): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const pattern = options.min < 0 ? /^-?\d{1,15}$/u : /^\d{1,15}$/u;
  if (!pattern.test(raw)) {
    throw new HttpBodyError("invalid_integer", "integer parameter is malformed");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < options.min || value > options.max) {
    throw new HttpBodyError("invalid_integer", "integer parameter is out of range");
  }
  return value;
}
