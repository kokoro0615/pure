import "server-only";
import { createSupabaseAdminClient } from "../supabaseAdmin";
import { getTicketWalletReadiness } from "../ticketWalletReadiness";
import { requireResendRuntimeConfiguration } from "../transactionalEmail/resendRuntimeConfiguration";
import { assertTicketCanaryRuntimeAuthority } from "./ticketCanaryRuntimeGuard";
import { readTicketAuthKeyring } from "./ticketAuthCrypto";
import { createTicketOrderEntryApi } from "./ticketOrderEntryApi";
import { createTicketEntryMaterial } from "./ticketOrderEntryCrypto";
import { readPublicOrigin, readTicketEnvironment } from "./ticketWalletProductionRuntime";
import { ticketWalletPrivateHeaders } from "./ticketWalletHttp";
import { runTicketMaintenanceRpc, type TicketMaintenanceOptions } from "./ticketMaintenanceRpc";

export async function handleTicketOrderEntry(request: Request, action: "exchange" | "read" | "prepare" | "commit" | "result", orderId?: string) {
  try {
    assertTicketCanaryRuntimeAuthority();
    const client = createSupabaseAdminClient();
    return await createTicketOrderEntryApi({
      keyring: readTicketAuthKeyring(), origin: readPublicOrigin(), environment: readTicketEnvironment(), account: "platform",
      async rpc(name, parameters) {
        const { data, error } = await client.rpc(name, parameters);
        if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("TICKET_ENTRY_RPC_FAILED");
        return data;
      },
      readiness() {
        const r = getTicketWalletReadiness();
        return { read: r.walletRead.ok, prepare: r.swipePrepare.ok, commit: r.swipeCommit.ok };
      },
    })(request, action, orderId);
  } catch {
    return Response.json({ ok: false, error: "feature_unavailable" }, { status: 503, headers: ticketWalletPrivateHeaders() });
  }
}

export async function materializeTicketEntryNotices(options: TicketMaintenanceOptions = {}) {
  assertTicketCanaryRuntimeAuthority();
  const client = createSupabaseAdminClient();
  const keyring = readTicketAuthKeyring(), origin = readPublicOrigin(), environment = readTicketEnvironment();
  const config = requireResendRuntimeConfiguration(process.env);
  const { data } = await runTicketMaintenanceRpc("read_ticket_entry_pending_v53", signal => client.rpc("read_ticket_entry_pending_v53", { p_environment: environment, p_account: "platform", p_limit: 100 }).abortSignal(signal), options);
  if (!Array.isArray(data)) throw new Error("TICKET_ENTRY_OUTBOX_READ_FAILED");
  for (const item of data) {
    const material = createTicketEntryMaterial(keyring, { orderId: item.orderId, eventSessionId: item.eventSessionId, generation: 1, environment, origin, account: "platform" });
    // Generate the key once. A lost response retries this exact material; the
    // SQL locks the order and reuses its already materialized link and email.
    const parameters = {
      p_order: material.orderId, p_event: material.eventSessionId, p_environment: environment, p_origin: origin, p_account: "platform",
      p_link: material.linkId, p_verifier: material.verifier, p_ciphertext: material.ciphertext, p_from: config.from, p_reply: config.replyTo,
    };
    await runTicketMaintenanceRpc("materialize_ticket_entry_v53", signal => client.rpc("materialize_ticket_entry_v53", parameters).abortSignal(signal), options);
  }
}
