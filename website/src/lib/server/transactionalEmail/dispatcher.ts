import 'server-only';
import type { runTransactionalEmailOutbox } from './outbox';
import { TransactionalEmailOutboxError } from './outbox';

type Batch = Awaited<ReturnType<typeof runTransactionalEmailOutbox>>;
/** Awaited bounded dispatch inside each durable cron invocation. DB is the queue,
 * lease, retry clock and provider-rate authority; no process-local continuation. */
export async function dispatchTransactionalEmail(input: Readonly<{
  runOne: () => Promise<Batch>;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  budgetMs?: number;
}>) {
  const now = input.now ?? (() => performance.now());
  const wait = input.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const budget = input.budgetMs ?? 45_000;
  if (!Number.isSafeInteger(budget) || budget < 1000 || budget > 45_000) throw new Error('invalid_dispatch_budget');
  const started = now();
  const summary = {claimed:0,accepted:0,retry:0,dead:0,configuration:0,errors:0,cadenceWaits:0,circuitWaits:0,polls:0};
  const errorCounts: Record<string, number> = {};
  // A hard iteration bound also protects tests/misconfigured clocks. Each call
  // claims at most one job, so a provider timeout cannot multiply by batch size.
  while (now() - started < budget && summary.polls < 500) {
    summary.polls++;
    let pause = 250;
    try {
      const result = await input.runOne();
      for (const key of ['claimed','accepted','retry','dead','configuration'] as const) summary[key] += result[key];
      // Materialization happens before this drain. Waiting on an empty outbox
      // cannot discover newly fulfilled orders and delays the next demo cycle.
      if (!result.claimed && !result.cadenceLimited && !result.circuitOpen) break;
      if (result.cadenceLimited) { summary.cadenceWaits++; pause=1000; }
      if (result.circuitOpen) { summary.circuitWaits++; pause=5000; }
    } catch (error) {
      // A claimed job remains durable, fenced by its DB lease. Do not report
      // provider acceptance for an unknown mark result or leak provider errors.
      summary.errors++; pause=1000;
      const code = error instanceof TransactionalEmailOutboxError ? error.code : 'TRANSACTIONAL_EMAIL_DISPATCH_UNKNOWN';
      errorCounts[code] = (errorCounts[code] ?? 0) + 1;
    }
    const remaining = budget - (now()-started);
    if (remaining > 0) await wait(Math.min(pause,remaining));
  }
  return {...summary, errorCounts, elapsedMs:Math.round(now()-started)};
}
