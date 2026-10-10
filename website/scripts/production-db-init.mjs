// Initialise the PURE production database — once, on an empty project.
//
//   node scripts/production-db-init.mjs <supabase.env> [--apply]
//
// The env file (owner-only, never committed) carries:
//   SUPABASE_URL                      https://<ref>.supabase.co
//   SUPABASE_SECRET_KEY               sb_secret_… (checked for shape only)
//   PURE_PRODUCTION_DATABASE_URL      direct (db.<ref>.supabase.co, user postgres)
//                                     or session pooler (aws-N-<region>.pooler.supabase.com:5432,
//                                     user postgres.<ref>)
//   PURE_PRODUCTION_DATABASE_CA_PATH  Supabase root CA (Dashboard → Database → SSL)
//
// Without --apply this is a dry run: binding, TLS identity and emptiness only.
// With --apply the business core, access policy, service-role ACL and the
// production seed load in ONE transaction; every invariant is asserted before
// COMMIT and any failure rolls the whole import back. No secret is printed.
import { readFile } from "node:fs/promises";
import pg from "pg";

import { assertInvariants, buildInitSql, readPrivilegeContract, shippedRpcNames } from "./lib/production-db-plan.mjs";

const DEVELOPMENT_REF = "airgkuioqioknxuqpciq";
const POOLER_HOST = /^aws-[0-9]+-[a-z]{2}-[a-z]+-[0-9]+\.pooler\.supabase\.com$/u;
const [envPath, mode] = process.argv.slice(2);
if (!envPath) throw new Error("usage: production-db-init.mjs <supabase.env> [--apply]");

const env = Object.fromEntries(
  (await readFile(envPath, "utf8"))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/u, "$2")];
    }),
);

const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/u.exec(env.SUPABASE_URL ?? "")?.[1];
if (!ref) throw new Error("SUPABASE_URL must be https://<20-char ref>.supabase.co");
if (ref === DEVELOPMENT_REF) throw new Error("refusing the development project");
if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(env.SUPABASE_SECRET_KEY ?? "")) {
  throw new Error("SUPABASE_SECRET_KEY must be a secret key");
}

let databaseUrl;
try {
  databaseUrl = new URL(env.PURE_PRODUCTION_DATABASE_URL ?? "");
} catch {
  throw new Error("PURE_PRODUCTION_DATABASE_URL is not a URL");
}
const username = decodeURIComponent(databaseUrl.username);
const direct = databaseUrl.hostname === `db.${ref}.supabase.co` && username === "postgres";
const pooler = POOLER_HOST.test(databaseUrl.hostname) && username === `postgres.${ref}`
  && (databaseUrl.port === "" || databaseUrl.port === "5432");
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || !(direct || pooler)) {
  throw new Error("PURE_PRODUCTION_DATABASE_URL must be the project's direct host or session pooler for this ref");
}
if (databaseUrl.pathname !== "/postgres") throw new Error("PURE_PRODUCTION_DATABASE_URL must target the postgres database");
const ca = await readFile(env.PURE_PRODUCTION_DATABASE_CA_PATH ?? "", "utf8").catch(() => "");
if (!ca.includes("BEGIN CERTIFICATE")) throw new Error("PURE_PRODUCTION_DATABASE_CA_PATH must point at the Supabase root CA");

// Credentials go to pg as fields, never via a connection string that could
// carry an sslmode overriding the verified TLS settings below.
const client = new pg.Client({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 5432),
  database: "postgres",
  user: username,
  password: decodeURIComponent(databaseUrl.password),
  ssl: { ca, rejectUnauthorized: true, servername: databaseUrl.hostname },
  statement_timeout: 0,
});
await client.connect();
try {
  const existing = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  const summary = { projectRef: ref, connection: direct ? "direct" : "session-pooler", publicTablesBefore: existing.rows[0].n };
  if (existing.rows[0].n !== 0) {
    console.log(JSON.stringify({ ...summary, ok: false, error: "database_not_empty" }));
    process.exitCode = 1;
  } else if (mode !== "--apply") {
    console.log(JSON.stringify({ ...summary, ok: true, mode: "dry-run" }));
  } else {
    const plan = await buildInitSql(".");
    const closure = (await readFile("database/production/admin-closure.txt", "utf8")).trim().split("\n");
    const requiredRpcNames = await shippedRpcNames(closure);
    await client.query("BEGIN");
    try {
      await client.query(plan.sql);
      const verified = await assertInvariants(client, { expectedTableCount: plan.expectedTableCount, requiredRpcNames, contract: await readPrivilegeContract(".") });
      await client.query("COMMIT");
      console.log(JSON.stringify({ ...summary, ok: true, mode: "applied", sqlSha256: plan.sha256, requiredRpcs: requiredRpcNames.length, ...verified }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.log(JSON.stringify({ ...summary, ok: false, mode: "rolled-back", error: error instanceof Error ? error.message : "failed" }));
      process.exitCode = 1;
    }
  }
} finally {
  await client.end();
}
