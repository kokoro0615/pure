import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

export const PRE_AUTH_COOKIE = "__Host-pure_ticket_wallet_pre_auth";
export const WALLET_COOKIE = "__Host-pure_ticket_wallet";
export const TICKET_WALLET_CSRF_HEADER = "x-csrf-token";

export type BrowserRequestRejection =
  | "origin_config_invalid"
  | "fetch_metadata_rejected"
  | "origin_required"
  | "origin_rejected"
  | "content_type_rejected"
  | "csrf_rejected";

export function ticketWalletCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    expires,
  };
}

export function ticketWalletPrivateHeaders() {
  return {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive",
  };
}

export function validateTicketWalletBrowserRequest(
  request: Request,
  options: { expectedOrigin: string; expectedCsrfToken: string },
): { ok: true } | { ok: false; error: BrowserRequestRejection } {
  if (!isExactHttpsOrigin(options.expectedOrigin)) {
    return { ok: false, error: "origin_config_invalid" };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return { ok: false, error: "fetch_metadata_rejected" };
  }

  const requestOrigin = readRequestOrigin(request);
  if (!requestOrigin) return { ok: false, error: "origin_required" };
  if (requestOrigin !== options.expectedOrigin) {
    return { ok: false, error: "origin_rejected" };
  }

  if (request.headers.get("content-type")?.trim().toLowerCase() !== "application/json") {
    return { ok: false, error: "content_type_rejected" };
  }

  const receivedCsrf = request.headers.get(TICKET_WALLET_CSRF_HEADER) ?? "";
  if (!constantTimeTextEqual(receivedCsrf, options.expectedCsrfToken)) {
    return { ok: false, error: "csrf_rejected" };
  }

  return { ok: true };
}

export async function readBoundedJsonObject(
  request: Request,
  maximumBytes: number,
): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 2) {
    throw new Error("request_body_limit_invalid");
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) throw new Error("request_body_invalid");
    if (Number(declared) > maximumBytes) throw new Error("request_body_too_large");
  }

  const text = await readBoundedBody(request, maximumBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("request_body_invalid");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request_body_invalid");
  }
  return parsed as Record<string, unknown>;
}

export function assertExactObjectKeys(
  object: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(object).some((key) => !allowed.has(key))) {
    throw new Error("request_fields_invalid");
  }
}

function readRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return isExactHttpsOrigin(origin) ? origin : null;

  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function isExactHttpsOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.origin === value
      && url.pathname === "/"
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function constantTimeTextEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

async function readBoundedBody(request: Request, maximumBytes: number) {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel("request_body_too_large");
        throw new Error("request_body_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") throw error;
    throw new Error("request_body_invalid");
  } finally {
    reader.releaseLock();
  }
}
