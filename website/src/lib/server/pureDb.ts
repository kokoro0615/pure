import "server-only";

import { Pool, types as pgTypes, type QueryResult, type QueryResultRow } from "pg";

/**
 * Pure DB client — a faithful subset of the supabase-js PostgREST client,
 * implemented over node-postgres so ported PURE server code runs verbatim.
 *
 * Contract preserved from supabase-js:
 * - `.rpc(name, params)` → `{ data, error }`; scalars unwrapped, setof → array,
 *   json/jsonb → parsed object, void → null.
 * - `.from(table)` → fluent query builder supporting select/insert/update/
 *   upsert/delete + PostgREST filters (eq/neq/gt/gte/lt/lte/in/is/like/ilike/
 *   not/or/match/filter/contains/overlaps), order/limit/range,
 *   single/maybeSingle/throwOnError/returns, head+count.
 * - Errors carry Postgres SQLSTATE in `error.code` (same as PostgREST),
 *   `error.message` = server message.
 */

export type PureDbError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export type PureDbResult<T> = {
  data: T | null;
  error: PureDbError | null;
  count?: number | null;
  status: number;
  statusText: string;
};

function pgError(error: unknown): PureDbError {
  const e = error as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: e?.message ?? "database_error",
    code: e?.code,
    details: e?.detail ?? null,
    hint: e?.hint ?? null,
  };
}

function errorStatus(code: string | undefined): number {
  if (!code) return 500;
  if (code === "23505" || code === "23503") return 409;
  if (code.startsWith("23") || code === "P0001") return 400;
  if (code === "PGRST116") return 406;
  return 500;
}

function fail<T>(error: PureDbError, status?: number): PureDbResult<T> {
  const s = status ?? errorStatus(error.code);
  return { data: null, error, status: s, statusText: `db_error_${error.code ?? "unknown"}` };
}

function jsonBindValue(v: unknown): unknown {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)
    ? JSON.stringify(v)
    : v;
}

function quoteIdent(ident: string): string {
  return '"' + ident.replace(/"/g, '""') + '"';
}

/** Quotes `a` or `a->>b`/`a->b` json-path column expressions. */
function quoteColumn(expr: string): string {
  const m = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(->>|->)\s*(.+)$/u);
  if (m) {
    const key = m[3].trim().replace(/^'|'$/g, "");
    return `${quoteIdent(m[1])}${m[2]}'${key.replace(/'/g, "''")}'`;
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/u.test(expr)) {
    throw new Error(`unsafe column identifier: ${expr}`);
  }
  return expr.split(".").map(quoteIdent).join(".");
}

type FilterOp =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike"
  | "is" | "in" | "cs" | "cd" | "ov" | "not";

const OP_SQL: Record<string, string> = {
  eq: "=", neq: "<>", gt: ">", gte: ">=",
  lt: "<", lte: "<=", like: "LIKE", ilike: "ILIKE",
  cs: "@>", cd: "<@", ov: "&&",
};

export type Row = QueryResultRow;

let pool: Pool | null = null;

/**
 * PostgREST emits text columns for temporal types — "YYYY-MM-DD" for date and
 * ISO-8601 for timestamp/timestamptz — and JSON numbers for int8/numeric.
 * node-postgres defaults to Date objects and strings, which breaks the ported
 * code's `typeof === "string"` / numeric comparisons. These parsers restore
 * PostgREST output shape. Raw text for timestamptz is
 * "YYYY-MM-DD HH:MM:SS(.frac)?+HH(:MM)?"; normalize to ISO with a colon offset.
 */
function postgresTimestampToIso(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:([+-]\d{2})(?::(\d{2}))?)?$/u.exec(value);
  if (!m) return value; // infinity / -infinity / BC pass through untouched
  const offset = m[3] ? `${m[3]}:${m[4] ?? "00"}` : "";
  return `${m[1]}T${m[2]}${offset}`;
}

const PURE_DB_TYPES = {
  getTypeParser(oid: number, format: "text" | "binary" | undefined) {
    if (format === "text") {
      if (oid === 1082) return (v: string) => v; // date
      if (oid === 1114 || oid === 1184) return postgresTimestampToIso;
      if (oid === 20 || oid === 1700) return (v: string) => Number(v); // int8, numeric
    }
    return pgTypes.getTypeParser(oid, format);
  },
};

function getPool(): Pool {
  if (!pool) {
    const url = process.env.PURE_DATABASE_URL;
    if (!url) {
      throw new Error("PURE_DATABASE_URL_missing");
    }
    pool = new Pool({
      connectionString: url,
      max: Number.parseInt(process.env.PURE_DB_POOL_MAX ?? "10", 10) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      types: PURE_DB_TYPES,
    });
  }
  return pool;
}

/** Test/maintenance helper: close the shared pool. */
export async function closePureDbPool(): Promise<void> {
  const p = pool;
  pool = null;
  if (p) await p.end();
}

// ---------------------------------------------------------------------------
// rpc()
// ---------------------------------------------------------------------------

type FnMeta = {
  retset: boolean;
  rettype: string;
  /** Declared IN/INOUT parameter name → information_schema data_type. */
  argTypes: Record<string, string>;
};
const fnMetaCache = new Map<string, Promise<FnMeta | null>>();

async function fnMeta(name: string): Promise<FnMeta | null> {
  let cached = fnMetaCache.get(name);
  if (!cached) {
    cached = (async () => {
      const r = await getPool().query(
        `select p.proretset as retset, t.typname as rettype,
                p.proname || '_' || p.oid::text as specific_name
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           join pg_type t on t.oid = p.prorettype
          where n.nspname = 'public' and p.proname = $1
          order by p.pronargs desc, p.oid desc
          limit 1`,
        [name],
      );
      const row = r.rows[0] as ({ retset: boolean; rettype: string; specific_name: string } | undefined);
      if (!row) return null;
      // Declared types drive parameter encoding: Postgres array params take
      // node-pg's native JS-array literal, while json/jsonb params take the
      // JSON string PostgREST would have sent.
      const args = await getPool().query(
        `select parameter_name, data_type
           from information_schema.parameters
          where specific_schema = 'public' and specific_name = $1
            and parameter_mode in ('IN','INOUT')`,
        [row.specific_name],
      );
      const argTypes: Record<string, string> = {};
      for (const arg of args.rows as { parameter_name: string; data_type: string }[]) {
        argTypes[arg.parameter_name] = arg.data_type;
      }
      return { retset: row.retset, rettype: row.rettype, argTypes };
    })();
    fnMetaCache.set(name, cached);
  }
  return cached;
}

async function rpcCall<T>(name: string, params: Record<string, unknown> | undefined): Promise<PureDbResult<T>> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(name)) {
    return fail({ message: `invalid rpc name: ${name}` });
  }
  try {
    const meta = await fnMeta(name);
    if (!meta) {
      return fail({ message: `Could not find the function public.${name} in the schema cache`, code: "PGRST202" }, 404);
    }
    const entries = Object.entries(params ?? {});
    const argSql = entries.map(([k], i) => `${quoteIdent(k)} := $${i + 1}`).join(", ");
    // Encoding follows the declared parameter type. A JS array bound to a
    // Postgres array parameter is passed through so node-pg emits an array
    // literal; the same array bound to jsonb must be the JSON string PostgREST
    // would have sent (PG array literal is not valid JSON).
    const values = entries.map(([k, v]) =>
      meta.argTypes[k] === "ARRAY" ? v : jsonBindValue(v));
    const sql = meta.retset
      ? `SELECT * FROM ${quoteIdent(name)}(${argSql})`
      : `SELECT ${quoteIdent(name)}(${argSql}) AS result`;
    const result = await getPool().query(sql, values);
    let data: unknown;
    if (meta.retset) {
      data = result.rows;
    } else {
      data = result.rows.length ? (result.rows[0] as Row).result : null;
    }
    return { data: data as T, error: null, status: 200, statusText: "OK" };
  } catch (error) {
    return fail(pgError(error));
  }
}

/**
 * Thenable RPC call matching the supabase-js PostgrestBuilder surface used by
 * the ported code (`await`, `.abortSignal()`, `.returns()`, `.throwOnError()`,
 * `.single()`/`.maybeSingle()` for scalar jsonb callers).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see note on PureDbClient.rpc below
class PureDbRpcCall<T = any> implements PromiseLike<PureDbResult<T>> {
  private signal: AbortSignal | null = null;
  private throwErr = false;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(
    private readonly name: string,
    private readonly params: Record<string, unknown> | undefined,
  ) {}

  abortSignal(signal: AbortSignal): this {
    this.signal = signal;
    return this;
  }

  throwOnError(): this {
    this.throwErr = true;
    return this;
  }

  returns<TNew = T>(): PureDbRpcCall<TNew> {
    return this as unknown as PureDbRpcCall<TNew>;
  }

  single(): this {
    this.singleMode = "single";
    return this;
  }

  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  private async execute(): Promise<PureDbResult<T>> {
    if (this.signal?.aborted) {
      const err = { message: "aborted", code: "ABORT_ERR" };
      if (this.throwErr) throw new Error(err.message);
      return fail(err);
    }
    const result = await rpcCall<T>(this.name, this.params);
    if (this.signal?.aborted) {
      const err = { message: "aborted", code: "ABORT_ERR" };
      if (this.throwErr) throw new Error(err.message);
      return fail(err);
    }
    // supabase-js unwraps single-object responses for setof-jsonb callers the
    // same way; callers only use single()/maybeSingle() on scalar results, so
    // no row-marshalling is needed here.
    if (result.error && this.throwErr) {
      throw Object.assign(new Error(result.error.message), { code: result.error.code });
    }
    return result;
  }

  then<TResult1 = PureDbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: PureDbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// from() fluent builder
// ---------------------------------------------------------------------------

type Clause = { sql: string; values: unknown[] };

const POSTGREST_SINGLE_ERROR: PureDbError = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
};

/** `data` for from() callers — always a row array (possibly empty). */
export type PureDbRowsResult<T> = Omit<PureDbResult<T>, "data"> & { data: T[] };

/** `data` for single()/maybeSingle() callers — a row or null, never an array. */
export type PureDbSingularResult<T> = Omit<PureDbResult<T>, "data"> & { data: T | null };

/**
 * Type-level view of the builder after `.single()`/`.maybeSingle()` —
 * supabase-js narrows `data` the same way; runtime behavior is identical.
 * Expressed as an intersection (not an interface extension) because `then`'s
 * callback parameter is contravariant across the two result shapes.
 */
export type PureDbSingularQuery<T> =
  Omit<PureDbQuery<T>, "then" | "single" | "maybeSingle"> & PromiseLike<PureDbSingularResult<T>>;

class PureDbQuery<T = Row> implements PromiseLike<PureDbRowsResult<T>> {
  private table: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private columns = "*";
  private headOnly = false;
  private countExact = false;
  private wheres: string[] = [];
  private values: unknown[] = [];
  private orderBy: string[] = [];
  private limitN: number | null = null;
  private offsetN = 0;
  private singleMode: "none" | "single" | "maybe" = "none";
  private payloadRows: Row[] | null = null;
  private updateSet: Row | null = null;
  private upsertConflict: string | null = null;
  private returningCols: string | null = null;
  private throwErr = false;

  constructor(table: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(table)) {
      throw new Error(`unsafe table name: ${table}`);
    }
    this.table = table;
  }

  select(columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): this {
    if (this.action === "insert" || this.action === "update" || this.action === "upsert" || this.action === "delete") {
      this.returningCols = columns === "*" ? "*" : columns;
      return this;
    }
    this.columns = columns;
    this.countExact = options?.count === "exact";
    this.headOnly = options?.head === true;
    return this;
  }

  insert(rows: Row | Row[], _options?: { count?: string; returning?: string; defaultToNull?: boolean }): this {
    this.action = "insert";
    this.payloadRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string; count?: string; ignoreDuplicates?: boolean }): this {
    this.action = "upsert";
    this.payloadRows = Array.isArray(rows) ? rows : [rows];
    this.upsertConflict = options?.onConflict ?? null;
    return this;
  }

  update(obj: Row): this {
    this.action = "update";
    this.updateSet = obj;
    return this;
  }

  delete(): this {
    this.action = "delete";
    return this;
  }

  private pushVal(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }

  private applyOp(col: string, op: string, val: unknown, negate = false): this {
    const c = quoteColumn(col);
    let cond: string;
    if (op === "is") {
      if (val === null || val === "null") cond = `${c} IS NULL`;
      else if (val === true || val === "true") cond = `${c} IS TRUE`;
      else if (val === false || val === "false") cond = `${c} IS FALSE`;
      else cond = `${c} IS ${this.pushVal(val)}`;
      cond = negate ? `NOT (${cond})` : cond;
    } else if (op === "in") {
      const arr = Array.isArray(val) ? val : [val];
      if (arr.length === 0) {
        cond = negate ? "TRUE" : "FALSE";
      } else {
        const ph = arr.map((v) => this.pushVal(v)).join(",");
        cond = `${c} IN (${ph})`;
        if (negate) cond = `NOT (${cond})`;
      }
    } else {
      const sqlOp = OP_SQL[op];
      if (!sqlOp) throw new Error(`unsupported filter op: ${op}`);
      cond = `${c} ${sqlOp} ${this.pushVal(val)}`;
      if (negate) cond = `NOT (${cond})`;
    }
    this.wheres.push(cond);
    return this;
  }

  eq(col: string, val: unknown): this { return this.applyOp(col, "eq", val); }
  neq(col: string, val: unknown): this { return this.applyOp(col, "neq", val); }
  gt(col: string, val: unknown): this { return this.applyOp(col, "gt", val); }
  gte(col: string, val: unknown): this { return this.applyOp(col, "gte", val); }
  lt(col: string, val: unknown): this { return this.applyOp(col, "lt", val); }
  lte(col: string, val: unknown): this { return this.applyOp(col, "lte", val); }
  like(col: string, val: unknown): this { return this.applyOp(col, "like", val); }
  ilike(col: string, val: unknown): this { return this.applyOp(col, "ilike", val); }
  is(col: string, val: unknown): this { return this.applyOp(col, "is", val); }
  in(col: string, vals: unknown[]): this { return this.applyOp(col, "in", vals); }
  contains(col: string, val: unknown): this { return this.applyOp(col, "cs", val); }
  containedBy(col: string, val: unknown): this { return this.applyOp(col, "cd", val); }
  overlaps(col: string, val: unknown): this { return this.applyOp(col, "ov", val); }
  match(obj: Row): this {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  filter(col: string, op: string, val: unknown): this {
    return this.applyOp(col, op.toLowerCase(), val);
  }
  not(col: string, op: string, val: unknown): this {
    return this.applyOp(col, op.toLowerCase(), val, true);
  }

  /** PostgREST `or=(cond,cond)` / `or=(col.op.val,...)` string form. */
  or(orString: string): this {
    const inner = orString.trim().replace(/^\((.*)\)$/u, "$1");
    const parts: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of inner) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    const groupVals: string[] = [];
    const conds = parts.map((part) => {
      const p = part.trim();
      const neg = p.startsWith("not.");
      const body = neg ? p.slice(4) : p;
      const m = body.match(/^([a-zA-Z_][a-zA-Z0-9_.]*(?:->>?\w+)?)\.([a-z]+)\.(.+)$/u);
      if (!m) throw new Error(`unsupported or() condition: ${p}`);
      const [, col, op, rawVal] = m;
      let val: unknown = rawVal;
      if (rawVal === "null") val = null;
      else if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (/^\d+$/u.test(rawVal)) val = Number(rawVal);
      else if (op === "in" && /^\(.*\)$/u.test(rawVal)) {
        val = rawVal.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      }
      groupVals.push(String(val));
      const c = quoteColumn(col);
      if (op === "is") {
        const base = val === null ? `${c} IS NULL` : `${c} IS ${this.pushVal(val)}`;
        return neg ? `NOT (${base})` : base;
      }
      if (op === "in") {
        const arr = val as unknown[];
        const ph = arr.map((v) => this.pushVal(v)).join(",");
        const base = arr.length ? `${c} IN (${ph})` : "FALSE";
        return neg ? `NOT (${base})` : base;
      }
      const sqlOp = OP_SQL[op];
      if (!sqlOp) throw new Error(`unsupported or() op: ${op}`);
      const base = `${c} ${sqlOp} ${this.pushVal(val)}`;
      return neg ? `NOT (${base})` : base;
    });
    if (conds.length) this.wheres.push(`(${conds.join(" OR ")})`);
    return this;
  }

  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string }): this {
    const dir = options?.ascending === false ? "DESC" : "ASC";
    const nulls = options?.nullsFirst === undefined ? "" : options.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
    this.orderBy.push(`${quoteColumn(col)} ${dir}${nulls}`);
    return this;
  }

  limit(n: number, _options?: { foreignTable?: string }): this {
    this.limitN = n;
    return this;
  }

  range(from: number, to: number, _options?: { foreignTable?: string }): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }

  single(): PureDbSingularQuery<T> {
    this.singleMode = "single";
    return this as unknown as PureDbSingularQuery<T>;
  }
  maybeSingle(): PureDbSingularQuery<T> {
    this.singleMode = "maybe";
    return this as unknown as PureDbSingularQuery<T>;
  }
  throwOnError(): this { this.throwErr = true; return this; }
  returns<TNew = T>(): PureDbQuery<TNew> { return this as unknown as PureDbQuery<TNew>; }
  abortSignal(_signal?: AbortSignal): this { return this; }
  setHeader(_k: string, _v: string): this { return this; }

  private whereSql(): string {
    return this.wheres.length ? ` WHERE ${this.wheres.join(" AND ")}` : "";
  }

  private buildInsert(): { sql: string; values: unknown[] } {
    const rows = this.payloadRows ?? [];
    if (!rows.length) throw new Error("insert requires at least one row");
    const keys = Object.keys(rows[0]);
    const vals: unknown[] = [];
    const rowSql = rows.map((row) => {
      const ph = keys.map((k) => {
        vals.push(jsonBindValue(row[k] === undefined ? null : row[k]));
        return `$${vals.length}`;
      });
      return `(${ph.join(",")})`;
    });
    let sql = `INSERT INTO ${quoteIdent(this.table)} (${keys.map(quoteIdent).join(",")}) VALUES ${rowSql.join(",")}`;
    if (this.action === "upsert") {
      const conflictCols = (this.upsertConflict ?? keys[0] ?? "id")
        .split(",").map((c) => quoteIdent(c.trim())).join(",");
      const updates = keys.map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(",");
      sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`;
    }
    sql += ` RETURNING ${this.returningCols ?? "*"}`;
    return { sql, values: vals };
  }

  private buildUpdate(): { sql: string; values: unknown[] } {
    const set = this.updateSet ?? {};
    const keys = Object.keys(set);
    if (!keys.length) throw new Error("update requires at least one column");
    const vals: unknown[] = keys.map((k) => jsonBindValue(set[k]));
    const sets = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(", ");
    this.values = vals.concat(this.values);
    // renumber where placeholders (they were assigned $1..$n before concat)
    const wheres = this.wheres.map((w) =>
      w.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + vals.length}`));
    let sql = `UPDATE ${quoteIdent(this.table)} SET ${sets}${wheres.length ? ` WHERE ${wheres.join(" AND ")}` : ""}`;
    sql += ` RETURNING ${this.returningCols ?? "*"}`;
    return { sql, values: this.values };
  }

  private buildDelete(): { sql: string; values: unknown[] } {
    let sql = `DELETE FROM ${quoteIdent(this.table)}${this.whereSql()}`;
    sql += ` RETURNING ${this.returningCols ?? "*"}`;
    return { sql, values: this.values };
  }

  private buildSelect(): { sql: string; countSql: string | null; values: unknown[] } {
    const cols = this.columns === "*" ? "*" : this.columns.split(",").map((c) => {
      const t = c.trim();
      return t === "*" || t.includes("(") ? t : quoteColumn(t);
    }).join(", ");
    const selectList = this.headOnly ? "1" : cols;
    let sql = `SELECT ${selectList} FROM ${quoteIdent(this.table)}${this.whereSql()}`;
    if (this.orderBy.length) sql += ` ORDER BY ${this.orderBy.join(", ")}`;
    if (this.limitN !== null) sql += ` LIMIT ${this.limitN}`;
    if (this.offsetN) sql += ` OFFSET ${this.offsetN}`;
    let countSql: string | null = null;
    if (this.countExact) {
      countSql = `SELECT count(*)::bigint AS c FROM ${quoteIdent(this.table)}${this.whereSql()}`;
    }
    return { sql, countSql, values: this.values };
  }

  private async execute(): Promise<PureDbRowsResult<T>> {
    try {
      let result: QueryResult;
      let count: number | null = null;
      if (this.action === "select") {
        const { sql, countSql, values } = this.buildSelect();
        if (this.headOnly) {
          const r = await getPool().query(
            `SELECT count(*)::bigint AS c FROM ${quoteIdent(this.table)}${this.whereSql()}`,
            values,
          );
          result = { rows: [], rowCount: Number((r.rows[0] as Row).c), command: "", oid: 0, fields: [] } as unknown as QueryResult;
          count = Number((r.rows[0] as Row).c);
        } else {
          result = await getPool().query(sql, values);
          if (countSql) {
            const cr = await getPool().query(countSql, values);
            count = Number((cr.rows[0] as Row).c);
          }
        }
      } else if (this.action === "insert" || this.action === "upsert") {
        const { sql, values } = this.buildInsert();
        result = await getPool().query(sql, values);
      } else if (this.action === "update") {
        const { sql, values } = this.buildUpdate();
        result = await getPool().query(sql, values);
      } else {
        const { sql, values } = this.buildDelete();
        result = await getPool().query(sql, values);
      }

      const rows = result.rows as T[];
      if (this.singleMode !== "none") {
        if (rows.length !== 1 && !(this.singleMode === "maybe" && rows.length === 0)) {
          const r = fail<T>(POSTGREST_SINGLE_ERROR, 406);
          if (this.throwErr) throw new Error(r.error!.message);
          return r as PureDbRowsResult<T>;
        }
      }
      const out: PureDbRowsResult<T> = {
        // Single-mode callers see the narrowed type through PureDbSingularQuery;
        // the runtime value is the row (or null), which is contract-correct.
        data: (this.singleMode !== "none" ? (rows[0] ?? null) : rows) as T[],
        error: null,
        status: this.action === "insert" ? 201 : 200,
        statusText: "OK",
      };
      if (count !== null) out.count = count;
      return out;
    } catch (error) {
      const r = fail<T>(pgError(error));
      if (this.throwErr) throw Object.assign(new Error(r.error!.message), { code: r.error!.code });
      return r as PureDbRowsResult<T>;
    }
  }

  then<TResult1 = PureDbRowsResult<T>, TResult2 = never>(
    onfulfilled?: ((value: PureDbRowsResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// client factory — drop-in for createSupabaseAdminClient()
// ---------------------------------------------------------------------------

export type PureDbClient = {
  // `any` mirrors supabase-js's untyped rpc() result; ported callers read
  // action/rows off `data` verbatim and would fight a narrower generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` mirrors supabase-js's untyped rpc() result (see comment above)
  rpc: <T = any>(name: string, params?: Record<string, unknown>) => PureDbRpcCall<T>;
  from: (table: string) => PureDbQuery;
};

let sharedClient: PureDbClient | null = null;

/**
 * Service-role equivalent client. Every method is a single statement against
 * the pool — atomicity lives inside the ported RPCs, same as the source
 * design where PostgREST calls are individually atomic.
 */
export function createPureDbClient(): PureDbClient {
  if (!sharedClient) {
    sharedClient = {
      rpc: <T>(name: string, params?: Record<string, unknown>) => new PureDbRpcCall<T>(name, params),
      from: (table: string) => new PureDbQuery(table),
    };
  }
  return sharedClient;
}

/** Raw escape hatch for migrations/seeds — never exposed through routes. */
export function getPureDbPool(): Pool {
  return getPool();
}
