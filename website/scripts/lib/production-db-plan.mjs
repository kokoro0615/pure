// The production database initialisation plan, shared by the production
// initializer and the local rehearsal so both run exactly the same SQL and the
// same acceptance checks.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const EXPECTED_TABLES = [
  ["VIP01", "pure-set-1", 10, "pure-set-premium"],
  ["VIP02", "pure-set-3", 8, "pure-set-c"],
  ["VIP03", "vip-4", 6, "vip-set"],
  ["VIP04", "floor-vip-5", 6, "floor-vip"],
  ["VIP05", "pure-set-2", 12, "pure-set"],
];

export async function readPrivilegeContract(root = ".") {
  return JSON.parse(await readFile(`${root}/database/production/privilege-contract.json`, "utf8"));
}

export async function buildInitSql(root = ".") {
  const core = (await readFile(`${root}/database/migrations/0001_business_core.sql`, "utf8"))
    .replace(/^CREATE POLICY ghost_console_read_select .*;\r?\n/gmu, "");
  const access = await readFile(`${root}/database/pure-cloud-access.sql`, "utf8");
  const acl = await readFile(`${root}/database/pure-service-role-acl.sql`, "utf8");
  const seed = await readFile(`${root}/database/production/0100_pure_production_seed.sql`, "utf8");
  const expectedTableCount = [...core.matchAll(/^CREATE TABLE public\./gmu)].length;
  // No BEGIN/COMMIT here: the caller owns the transaction so it can verify
  // before committing.
  const sql = `${core}\n${access}\n${acl}\n${seed}\n`;
  return { sql, expectedTableCount, sha256: createHash("sha256").update(sql).digest("hex") };
}

async function scalar(client, text, values = []) {
  const { rows } = await client.query(text, values);
  return rows[0];
}

/** Every invariant the production database must satisfy. Throws on the first failure. */
export async function assertInvariants(client, { expectedTableCount, minEventDays = 120, requiredRpcNames = [], contract = null }) {
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };

  const tables = await scalar(client, `
    select count(*)::int as n, count(*) filter (where not c.relrowsecurity)::int as without_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'`);
  check(tables.n === expectedTableCount, `public tables ${tables.n} != ${expectedTableCount}`);
  check(tables.without_rls === 0, `${tables.without_rls} public tables without RLS`);

  // Public roles: no effective privilege of any kind (has_*_privilege follows
  // PUBLIC and role inheritance, unlike the grant catalog views).
  const publicAccess = await scalar(client, `
    select
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(priv)
        cross join unnest(array['anon','authenticated']) r(role)
        where n.nspname = 'public' and c.relkind in ('r','v','m','p') and has_table_privilege(r.role, c.oid, p.priv))::int as tables,
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        cross join unnest(array['anon','authenticated']) r(role)
        where n.nspname = 'public' and c.relkind = 'S'
          and (has_sequence_privilege(r.role, c.oid, 'USAGE') or has_sequence_privilege(r.role, c.oid, 'SELECT') or has_sequence_privilege(r.role, c.oid, 'UPDATE')))::int as sequences,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        cross join unnest(array['anon','authenticated']) r(role)
        where n.nspname = 'public' and has_function_privilege(r.role, p.oid, 'EXECUTE'))::int as routines,
      (select count(*) from information_schema.column_privileges
        where table_schema = 'public' and grantee in ('PUBLIC','anon','authenticated'))::int as columns`);
  check(publicAccess.tables === 0, `${publicAccess.tables} table privileges reachable by anon/authenticated`);
  check(publicAccess.sequences === 0, `${publicAccess.sequences} sequences reachable by anon/authenticated`);
  check(publicAccess.routines === 0, `${publicAccess.routines} routines executable by anon/authenticated`);
  check(publicAccess.columns === 0, `${publicAccess.columns} column grants to public roles`);

  // Column-level ACLs: PURE grants nothing per column, so any column ACL is a
  // bypass of the table contract (table checks do not see column grants).
  const columns = await scalar(client, `
    select
      (select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped and a.attacl is not null)::int as acls,
      (select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p(priv)
        cross join unnest(array['anon','authenticated']) r(role)
        where n.nspname = 'public' and c.relkind in ('r','v','m','p') and a.attnum > 0 and not a.attisdropped
          and has_column_privilege(r.role, c.oid, a.attnum, p.priv))::int as effective_public`);
  check(columns.acls === 0, `${columns.acls} public columns carry a column-level ACL`);
  check(columns.effective_public === 0, `${columns.effective_public} column privileges reachable by anon/authenticated`);

  // service_role: every object exactly as the contract says, nothing more.
  if (contract) {
    const { rows: tablePrivileges } = await client.query(`
      select c.relname as name,
             coalesce(array_agg(p.priv order by p.priv) filter (where has_table_privilege('service_role', c.oid, p.priv)), '{}') as privileges
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(priv)
      where n.nspname = 'public' and c.relkind = 'r'
      group by c.relname`);
    for (const row of tablePrivileges) {
      const expected = contract.tables[row.name];
      if (!expected) { failures.push(`table ${row.name} is not in the privilege contract`); continue; }
      const actual = [...row.privileges].sort().join(",");
      check(actual === [...expected].sort().join(","), `table ${row.name}: service_role has [${actual}], contract [${expected.join(",")}]`);
    }
    const { rows: routines } = await client.query(`
      select regexp_replace(p.oid::regprocedure::text, '^public\\.', '') as signature,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as executable
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`);
    for (const row of routines) {
      const expected = contract.functions[row.signature];
      if (expected === undefined) { failures.push(`function ${row.signature} is not in the privilege contract`); continue; }
      check(row.executable === expected, `function ${row.signature}: service_role EXECUTE ${row.executable}, contract ${expected}`);
    }
    const { rows: sequences } = await client.query(`
      select c.relname as name,
             coalesce(array_agg(p.priv order by p.priv) filter (where has_sequence_privilege('service_role', c.oid, p.priv)), '{}') as privileges
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['SELECT','USAGE','UPDATE']) p(priv)
      where n.nspname = 'public' and c.relkind = 'S'
      group by c.relname`);
    for (const row of sequences) {
      const expected = contract.sequences[row.name];
      if (!expected) { failures.push(`sequence ${row.name} is not in the privilege contract`); continue; }
      const actual = [...row.privileges].sort().join(",");
      check(actual === [...expected].sort().join(","), `sequence ${row.name}: service_role has [${actual}], contract [${expected.join(",")}]`);
    }
  }

  // The contract itself must keep the protections GHOST established.
  if (contract) {
    check(JSON.stringify(contract.tables.audit_logs) === JSON.stringify(["SELECT"]), "contract: audit_logs must be SELECT-only");
    check(Array.isArray(contract.tables.transactional_email_jobs) && contract.tables.transactional_email_jobs.length === 0,
      "contract: transactional_email_jobs must be closed");
    check(contract.functions["admit_ticket_v23(text,uuid)"] === false, "contract: admit_ticket_v23 must be closed");
    for (const table of ["external_finance_reviews", "stripe_disputes"]) {
      check(!(contract.tables[table] ?? []).includes("DELETE"), `contract: ${table} must not allow DELETE`);
    }
  }

  // Every RPC the shipped server code calls must stay executable by the server.
  if (requiredRpcNames.length > 0) {
    const { rows } = await client.query(`
      select p.proname, bool_or(has_function_privilege('service_role', p.oid, 'EXECUTE')) as can_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])
      group by p.proname`, [requiredRpcNames]);
    const executable = new Set(rows.filter((row) => row.can_execute).map((row) => row.proname));
    const missing = requiredRpcNames.filter((name) => !executable.has(name));
    check(missing.length === 0, `server RPCs not executable by service_role: ${missing.join(", ")}`);
  }

  // Floor data: exactly the five zones, mapped one offering each.
  const { rows: seats } = await client.query(`
    select s.display_code, s.public_resource_code, s.capacity_min, s.capacity_max,
           coalesce(o.public_offering_id, og.public_offering_id) as offering
    from public.seat_resources s
    left join public.offering_resource_requirements r on r.seat_resource_id = s.id
    left join public.booking_offerings o on o.id = r.booking_offering_id
    left join public.resource_group_members m on m.seat_resource_id = s.id
    left join public.offering_resource_requirements rg on rg.resource_group_id = m.resource_group_id
    left join public.booking_offerings og on og.id = rg.booking_offering_id
    where s.active
    order by s.sort_order`);
  check(JSON.stringify(seats.map((s) => [s.display_code, s.public_resource_code, s.capacity_max, s.offering]))
    === JSON.stringify(EXPECTED_TABLES), `active tables/offerings differ: ${JSON.stringify(seats)}`);
  check(seats.every((s) => s.capacity_min === 1), "every table starts at capacity 1");

  const days = await scalar(client, `
    select count(*)::int as n,
           bool_and(operating_status = 'open') as all_open,
           max(business_date) >= ((now() at time zone 'Asia/Tokyo')::date + $1::int) as covers
    from public.event_days`, [minEventDays]);
  check(days.n >= minEventDays && days.all_open && days.covers, `event days insufficient: ${JSON.stringify(days)}`);

  // Objects created later by the owner role must start closed. Probe inside a
  // savepoint, as `postgres` (the Supabase creator role), then roll it back.
  const probe = await probeDefaultPrivileges(client);
  check(probe.ok, `new objects are not closed by default: ${JSON.stringify(probe)}`);

  if (failures.length > 0) {
    const error = new Error(`production_db_invariants_failed: ${failures.join("; ")}`);
    error.failures = failures;
    throw error;
  }
  return { publicTables: tables.n, activeTables: seats.map((s) => s.display_code), eventDays: days.n };
}

/*
 * RPCs whose only call sites are dead code, retired on purpose by the GHOST
 * history: v59 revoked EXECUTE on create_ticket_order_v23 because its single
 * caller (createPendingTicketOrder in ticketOrders.ts) has no callers.
 */
export const RETIRED_RPC_CALL_SITES = new Set(["create_ticket_order_v23"]);

/** RPC names the shipped server code calls (`.rpc("name"` / `rpcName: "name"`). */
export async function shippedRpcNames(files) {
  const names = new Set();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/(?:\.rpc\(\s*|rpcName:\s*)["'`]([a-z0-9_]+)["'`]/gu)) names.add(match[1]);
  }
  return [...names].filter((name) => !RETIRED_RPC_CALL_SITES.has(name)).sort();
}

async function probeDefaultPrivileges(client) {
  await client.query("SAVEPOINT pure_default_privilege_probe");
  try {
    await client.query("SET LOCAL ROLE postgres");
    await client.query(`
      CREATE TABLE public.__pure_acl_probe (id integer);
      CREATE SEQUENCE public.__pure_acl_probe_seq;
      CREATE FUNCTION public.__pure_acl_probe_fn() RETURNS integer LANGUAGE sql AS 'select 1';`);
    // Every privilege mode, through has_*_privilege so role inheritance counts.
    const { rows } = await client.query(`
      select r.role,
        (select bool_or(has_table_privilege(r.role, 'public.__pure_acl_probe', p.priv))
          from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(priv)) as table_access,
        (select bool_or(has_sequence_privilege(r.role, 'public.__pure_acl_probe_seq', p.priv))
          from unnest(array['USAGE','SELECT','UPDATE']) p(priv)) as sequence_access,
        has_function_privilege(r.role, 'public.__pure_acl_probe_fn()', 'EXECUTE') as function_access
      from unnest(array['anon','authenticated','service_role']) r(role)`);
    const open = rows.filter((row) => row.table_access || row.sequence_access || row.function_access);
    return { ok: open.length === 0, open };
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT pure_default_privilege_probe");
    await client.query("RELEASE SAVEPOINT pure_default_privilege_probe");
  }
}
