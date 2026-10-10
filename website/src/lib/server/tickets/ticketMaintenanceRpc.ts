import "server-only";

// These RPCs are reads or transactional, idempotent maintenance. Never add a
// payment, admission, provider send, lease claim or budget reservation here.
const operations = new Set([
  "materialize_ticket_purchase_notices_v33",
  "read_ticket_entry_pending_v53",
  "materialize_ticket_entry_v53",
  "retire_ticket_purchase_delivery_v38",
  "record_ticket_worker_heartbeat_v38",
]);

type Result = Readonly<{ error: unknown; status: number }>;
type Diagnostic = Readonly<{
  operation: string; attempt: number; httpStatus: number; sqlState: string | null;
  elapsedMs: number; retryScheduled: boolean;
}>;

export class TicketMaintenanceRpcError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(diagnostic: Diagnostic) {
    super("TICKET_MAINTENANCE_RPC_FAILED");
    this.diagnostic = diagnostic;
  }
}

export type TicketMaintenanceOptions = Readonly<{
  deadline?: number;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  observe?: (diagnostic: Diagnostic) => void;
}>;

/** Retry only a known transient DB API outcome with identical caller inputs.
 * An unknown successful commit is safe only for the explicit allowlist above.
 * Counters, credentials, recipients and provider/SQL error text never enter logs.
 */
export async function runTicketMaintenanceRpc<T extends Result>(
  operation: string,
  run: (signal: AbortSignal) => PromiseLike<T>,
  options: TicketMaintenanceOptions = {},
): Promise<T> {
  if (!operations.has(operation)) throw new Error("ticket_maintenance_operation_forbidden");
  const now = options.now ?? (() => performance.now());
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const observe = options.observe ?? (event => console.warn("pure_ticket_maintenance_rpc", event));
  const deadline = options.deadline ?? now() + 20_000;
  if (!Number.isFinite(deadline)) throw new Error("ticket_maintenance_deadline_invalid");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = now();
    if (deadline - started < 1) throw new TicketMaintenanceRpcError({ operation, attempt, httpStatus: 0, sqlState: null, elapsedMs: 0, retryScheduled: false });
    const signal = AbortSignal.timeout(Math.max(1, Math.floor(Math.min(6_000, deadline - started))));
    let result: T | undefined;
    let failure: unknown;
    try { result = await run(signal); failure = result.error; }
    catch (error) { failure = error; }
    if (result && !result.error && result.status >= 200 && result.status < 300) return result;
    const row = failure && typeof failure === "object" ? failure as Record<string, unknown> : {};
    const sqlState = typeof row.code === "string" && /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(row.code) ? row.code : null;
    const status = result?.status ?? 0;
    const transportFailure = !result && (signal.aborted || failure instanceof TypeError);
    const transient = [502, 503, 504].includes(status) || (status === 0 && (transportFailure || !!result && sqlState === null));
    const pause = attempt === 1 ? 250 : 750;
    const retryScheduled = transient && attempt < 3 && deadline - now() > pause + 1;
    const diagnostic = { operation, attempt, httpStatus: status, sqlState, elapsedMs: Math.round(now() - started), retryScheduled };
    observe(diagnostic);
    if (!retryScheduled) throw new TicketMaintenanceRpcError(diagnostic);
    await wait(pause);
  }
  throw new Error("ticket_maintenance_attempt_bound");
}
