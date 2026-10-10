// Rehearse the production initialisation on a throwaway LOCAL database:
//   node scripts/production-db-rehearsal.mjs
// Uses the same SQL and the same pre-COMMIT invariants as production-db-init.mjs.
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import pg from "pg";

import { assertInvariants, buildInitSql, readPrivilegeContract, shippedRpcNames } from "./lib/production-db-plan.mjs";

nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.env.PURE_DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("rehearsal runs on a local database only");

const admin = new pg.Client({ connectionString: base.toString() });
await admin.connect();
await admin.query("DROP DATABASE IF EXISTS pure_prod_rehearsal");
await admin.query("CREATE DATABASE pure_prod_rehearsal");
await admin.end();

const target = new URL(base); target.pathname = "/pure_prod_rehearsal";
const client = new pg.Client({ connectionString: target.toString() });
await client.connect();
try {
  // What a new Supabase project already provides.
  await client.query("CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;");
  const plan = await buildInitSql(".");
  const contract = await readPrivilegeContract(".");
  const closure = (await readFile("database/production/admin-closure.txt", "utf8")).trim().split("\n");
  const requiredRpcNames = await shippedRpcNames(closure);
  const options = { expectedTableCount: plan.expectedTableCount, requiredRpcNames, contract };

  // Negative cases: each injected violation must fail the checks and roll the
  // whole import back, leaving an empty schema.
  const violations = {
    "finance DELETE": "GRANT DELETE ON public.stripe_disputes TO service_role",
    "audit INSERT": "GRANT INSERT ON public.audit_logs TO service_role",
    "public table read": "GRANT SELECT ON public.seat_resources TO anon",
    "public routine": "GRANT EXECUTE ON FUNCTION public.get_admin_vip_floor_board_v8(uuid, date) TO PUBLIC",
    "unlisted sequence": "GRANT USAGE ON SEQUENCE public.ticket_sale_interruptions_id_seq TO service_role",
    "floor data": "UPDATE public.seat_resources SET capacity_max = 99 WHERE display_code = 'VIP01'",
    "public column via role": "CREATE ROLE pure_probe_reader NOLOGIN; GRANT SELECT (name) ON public.seat_resources TO pure_probe_reader; GRANT pure_probe_reader TO anon",
    "audit column write": "GRANT UPDATE (action) ON public.audit_logs TO service_role",
    "future function default": "ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC",
    "inherited future sequence write": "CREATE ROLE pure_probe_seq_writer NOLOGIN; GRANT pure_probe_seq_writer TO anon; ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT UPDATE ON SEQUENCES TO pure_probe_seq_writer",
    "inherited future table trigger": "CREATE ROLE pure_probe_table_owner NOLOGIN; GRANT pure_probe_table_owner TO authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT REFERENCES, TRIGGER ON TABLES TO pure_probe_table_owner",
  };
  const negative = {};
  for (const [name, statement] of Object.entries(violations)) {
    await client.query("BEGIN");
    try {
      await client.query(plan.sql);
      await client.query(statement);
      await assertInvariants(client, options);
      negative[name] = "NOT DETECTED";
    } catch (error) {
      negative[name] = error instanceof Error && error.message.startsWith("production_db_invariants_failed") ? "rolled back" : `error: ${error.message}`;
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    const left = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
    if (left.rows[0].n !== 0) negative[name] += " (schema not empty!)";
  }

  await client.query("BEGIN");
  try {
    await client.query(plan.sql);
    const verified = await assertInvariants(client, options);
    await client.query("COMMIT");
    const ok = Object.values(negative).every((outcome) => outcome === "rolled back");
    console.log(JSON.stringify({ ok, negative, sqlSha256: plan.sha256, requiredRpcs: requiredRpcNames.length, ...verified }));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.log(JSON.stringify({ ok: false, negative, error: error instanceof Error ? error.message : "failed" }));
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
