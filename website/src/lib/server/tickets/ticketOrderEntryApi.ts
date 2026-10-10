import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { TicketAuthKeyring } from "./ticketAuthCrypto";
import { ENTRY_KEY_ID, ENTRY_TOKEN, ENTRY_UUID, ticketEntryDigest } from "./ticketOrderEntryCrypto";
import { assertExactObjectKeys, readBoundedJsonObject, ticketWalletPrivateHeaders, validateTicketWalletBrowserRequest } from "./ticketWalletHttp";

type Json = Record<string, unknown>;
type Action = "exchange" | "read" | "prepare" | "commit" | "result";
type Authority = { id: string; keyId: string; token: string; csrf: string };
export type TicketOrderEntryApiDependencies = Readonly<{
  keyring: TicketAuthKeyring; origin: string; environment: "test" | "live"; account: string;
  rpc(name: string, parameters: Json): Promise<Json>;
  readiness(): { read: boolean; prepare: boolean; commit: boolean };
}>;

export function createTicketOrderEntryApi(d: TicketOrderEntryApiDependencies) {
  return async (request: Request, action: Action, orderId?: string): Promise<Response> => {
    const requestId = randomUUID();
    const headers = new Headers({ ...ticketWalletPrivateHeaders(), "x-request-id": requestId, "x-content-type-options": "nosniff" });
    const respond = (body: Json, status = 200) => Response.json(body, { status, headers });
    const error = (code: string, status: number) => respond({ ok: false, error: code, requestId }, status);
    try {
      const readiness = d.readiness();
      if (!(action === "prepare" ? readiness.prepare : action === "commit" ? readiness.commit : readiness.read)) return error("feature_unavailable", 503);
      const mutation = ["exchange", "prepare", "commit"].includes(action);
      if (request.method !== (mutation ? "POST" : "GET")) return error("invalid_request", 405);
      // Reject cross-origin reads, including same-site sibling hosts.
      if (new URL(request.url).origin !== d.origin
        || (request.headers.has("origin") && request.headers.get("origin") !== d.origin)
        || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return error("invalid_request", 403);
      const base = { p_environment: d.environment, p_origin: d.origin, p_account: d.account };
      if (action === "exchange") {
        // The body bearer is the exchange authority. No cookie is overwritten
        // until verification; Origin + JSON prevent a cross-site login swap.
        if (!validateTicketWalletBrowserRequest(request, { expectedOrigin: d.origin, expectedCsrfToken: "" }).ok) return error("invalid_request", 403);
        const body = await readBoundedJsonObject(request, 1024);
        assertExactObjectKeys(body, ["linkId", "keyId", "secret"]);
        const linkId = uuid(body.linkId), keyId = keyIdValue(body.keyId), secret = token(body.secret);
        if (!d.keyring.keyFor(keyId)) return error("entry_link_unavailable", 401);
        let authority: Authority = { id: randomUUID(), keyId: d.keyring.activeKeyId, token: randomBytes(32).toString("base64url"), csrf: randomBytes(32).toString("base64url") };
        const result = await d.rpc("exchange_ticket_order_entry_v52", {
          ...base, p_link: linkId, p_token: ticketEntryDigest(d.keyring, "link", `${linkId}:${secret}`, keyId),
          p_session: authority.id, p_session_token: digest(d, authority, "session", authority.token), p_csrf: digest(d, authority, "csrf", authority.csrf),
        });
        if (result.action !== "exchanged") return error("entry_link_unavailable", result.reason === "rate_limited" ? 429 : 401);
        const id = uuid(result.orderId);
        const existing = readAuthority(request, id, d.keyring);
        if (existing) {
          const reuse = await d.rpc("reuse_ticket_order_entry_session_v53", { ...base, p_order: id, p_link: linkId,
            p_session: existing.id, p_token: digest(d, existing, "session", existing.token) });
          if (reuse.action === "reused") authority = existing;
        }
        if (typeof result.expiresAt !== "string" || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("entry_rpc_invalid");
        headers.append("set-cookie", `${entryCookieName(id)}=${["v1", authority.keyId, authority.id, authority.token, authority.csrf].join(":")}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(result.expiresAt).toUTCString()}`);
        return respond({ ok: true, orderId: id });
      }
      const id = uuid(orderId);
      const authority = readAuthority(request, id, d.keyring);
      if (!authority) return error("entry_session_expired", 401);
      if (mutation && !validateTicketWalletBrowserRequest(request, { expectedOrigin: d.origin, expectedCsrfToken: authority.csrf }).ok) return error("invalid_request", 403);
      const parameters: Json = { ...base, p_order: id, p_session: authority.id, p_token: digest(d, authority, "session", authority.token) };
      let result: Json;
      if (action === "read") {
        if (new URL(request.url).search) throw invalid();
        result = await d.rpc("read_ticket_order_entry_v52", parameters);
        if (result.action === "read") return respond({ ok: true, ...result, csrfToken: authority.csrf });
      } else if (action === "result") {
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].some(k => k !== "operationId") || url.searchParams.getAll("operationId").length !== 1) throw invalid();
        result = await d.rpc("read_ticket_order_entry_result_v52", { ...parameters, p_operation: uuid(url.searchParams.get("operationId")) });
      } else {
        const idempotencyKey = uuid(request.headers.get("idempotency-key"));
        const body = await readBoundedJsonObject(request, 2048);
        parameters.p_csrf = digest(d, authority, "csrf", authority.csrf);
        if (action === "prepare") {
          assertExactObjectKeys(body, ["admissionIds"]);
          if (!Array.isArray(body.admissionIds) || body.admissionIds.length < 1 || body.admissionIds.length > 20) throw invalid();
          const ids = body.admissionIds.map(uuid).sort();
          if (new Set(ids).size !== ids.length) throw invalid();
          result = await d.rpc("prepare_ticket_order_entry_v52", {
            ...parameters, p_ids: ids, p_prepare_key: digest(d, authority, "prepare", idempotencyKey),
            p_request_hash: digest(d, authority, "request", JSON.stringify([id, ids])),
            p_challenge: challenge(d, authority, idempotencyKey), p_operation: randomUUID(),
          });
        } else {
          assertExactObjectKeys(body, ["operationId", "prepareKey"]);
          const operationId = uuid(body.operationId), prepareKey = uuid(body.prepareKey);
          result = await d.rpc("commit_ticket_order_entry_v52", {
            ...parameters, p_operation: operationId, p_commit_key: digest(d, authority, "commit", idempotencyKey),
            p_request_hash: digest(d, authority, "request", JSON.stringify([id, operationId, prepareKey])),
            p_challenge: challenge(d, authority, prepareKey),
          });
        }
      }
      if (result.action === "unauthenticated") return error("entry_session_expired", 401);
      if (["prepared", "result"].includes(String(result.action))) return respond({ ok: true, ...result });
      return error(safeReason(result.reason), result.action === "not_found" ? 404 : 409);
    } catch (caught) {
      return error(caught instanceof Error && /^(entry_request_invalid|request_)/u.test(caught.message) ? "invalid_request" : "server_error", caught instanceof Error && /^(entry_request_invalid|request_)/u.test(caught.message) ? 400 : 500);
    }
  };
}

export function entryCookieName(order: string) { return `__Host-pure_ticket_order_${uuid(order)}`; }
function readAuthority(request: Request, order: string, keyring: TicketAuthKeyring): Authority | null {
  const name = `${entryCookieName(order)}=`;
  const matches = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(name));
  if (matches.length !== 1) return null;
  const [version, keyId, id, secret, csrf, extra] = matches[0].slice(name.length).split(":");
  if (version !== "v1" || extra !== undefined || !ENTRY_KEY_ID.test(keyId) || !keyring.keyFor(keyId) || !ENTRY_UUID.test(id) || !ENTRY_TOKEN.test(secret) || !ENTRY_TOKEN.test(csrf)) return null;
  return { keyId, id, token: secret, csrf };
}
function digest(d: TicketOrderEntryApiDependencies, a: Authority, purpose: "session" | "csrf" | "prepare" | "commit" | "request", value: string) {
  return ticketEntryDigest(d.keyring, purpose, `${a.id}:${value}`, a.keyId);
}
function challenge(d: TicketOrderEntryApiDependencies, a: Authority, prepareKey: string) {
  return ticketEntryDigest(d.keyring, "challenge", `${a.id}:${a.token}:${prepareKey}`, a.keyId);
}
function uuid(value: unknown) { if (typeof value !== "string" || !ENTRY_UUID.test(value)) throw invalid(); return value.toLowerCase(); }
function token(value: unknown) { if (typeof value !== "string" || !ENTRY_TOKEN.test(value) || Buffer.from(value, "base64url").toString("base64url") !== value) throw invalid(); return value; }
function keyIdValue(value: unknown) { if (typeof value !== "string" || !ENTRY_KEY_ID.test(value)) throw invalid(); return value; }
function invalid() { return new Error("entry_request_invalid"); }
function safeReason(value: unknown) {
  const allowed = ["whole_order_selection_required", "idempotency_mismatch", "challenge_expired", "version_conflict", "policy_version_changed", "admission_not_open", "admission_window_closed", "event_session_closed", "payment_not_settled", "refund_review_required", "rate_limited"];
  return typeof value === "string" && allowed.includes(value) ? value : "entry_unavailable";
}
