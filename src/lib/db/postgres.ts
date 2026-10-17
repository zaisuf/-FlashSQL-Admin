import { Pool, type PoolClient } from "pg";
import type { SqlDriver, RowQuery, UpdateQuery, UpdateResult } from "./interface";
import type { ColumnInfo, ConnConfig, QueryResult, RowResult, TableInfo } from "@/lib/types";
import { assertIdent, escapeLike, LIKE_ESCAPE, quotePg } from "./ident";
import { serializeRow } from "./serialize";

const CONNECTION_ERROR =
  /Connection terminated|connection timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EPIPE|socket hang up|terminating connection|server closed the connection|Client has encountered a connection error/i;

function createPool(config: ConnConfig): Pool {
  return new Pool({
    host: config.host || "localhost",
    port: config.port || 5432,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 4,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    query_timeout: 60000,
    statement_timeout: 60000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
}

export class PostgresDriver implements SqlDriver {
  private pool: Pool;

  constructor(public readonly config: ConnConfig) {
    this.pool = createPool(config);
  }

  private async withRetry<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!CONNECTION_ERROR.test(message)) throw error;
      const stale = this.pool;
      this.pool = createPool(this.config);
      await stale.end().catch(() => undefined);
      return await run();
    }
  }

  private async withClient<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withRetry(async () => {
      const client = await this.pool.connect();
      try {
        return await run(client);
      } finally {
        client.release();
      }
    });
  }

  async test(): Promise<void> {
    await this.withRetry(() => this.pool.query("SELECT 1").then(() => undefined));
  }

  async listDatabases(): Promise<string[]> {
    const res = await this.withRetry(() =>
      this.pool.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"),
    );
    return res.rows.map((row) => row.datname as string);
  }

  async listTables(_database?: string, schema?: string): Promise<TableInfo[]> {
    const res = await this.withRetry(() =>
      this.pool.query(
        `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_type = 'BASE TABLE'
           AND table_schema NOT IN ('pg_catalog', 'information_schema')
           ${schema ? "AND table_schema = $1" : ""}
         ORDER BY table_schema, table_name`,
        schema ? [schema] : [],
      ),
    );
    return res.rows.map((row) => ({ schema: row.table_schema as string, name: row.table_name as string }));
  }

  async getColumns(table: string, schema = "public"): Promise<ColumnInfo[]> {
    assertIdent(table);
    assertIdent(schema);
    return this.withRetry(async () => {
      const cols = await this.pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table],
      );
      const keys = await this.pool.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2`,
        [schema, table],
      );
      const pk = new Set(keys.rows.map((row) => row.column_name as string));
      return cols.rows.map((col) => ({
        name: col.column_name as string,
        type: col.data_type as string,
        nullable: col.is_nullable === "YES",
        defaultValue: (col.column_default as string) ?? null,
        isPrimaryKey: pk.has(col.column_name as string),
      }));
    });
  }

  async getRows(query: RowQuery): Promise<RowResult> {
    const started = Date.now();
    const schema = query.schema || "public";
    const table = `${quotePg(schema)}.${quotePg(query.table)}`;
    const order = query.orderBy
      ? `ORDER BY ${quotePg(query.orderBy)} ${query.orderDir === "desc" ? "DESC" : "ASC"}`
      : "";
    const columns = await this.getColumns(query.table, schema);
    const term = query.search?.trim();
    const params: unknown[] = [];
    let where = "";
    if (term && columns.length > 0) {
      params.push(`%${escapeLike(term)}%`);
      const haystack = columns
        .map((column) => `COALESCE(CAST(${quotePg(column.name)} AS TEXT), '')`)
        .join(" || ' ' || ");
      where = `WHERE ${haystack} ILIKE $1 ESCAPE '${LIKE_ESCAPE}'`;
    }
    const [rows, count] = await this.withRetry(() =>
      Promise.all([
        this.pool.query(
          `SELECT * FROM ${table} ${where} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, query.limit, query.offset],
        ),
        this.pool.query(`SELECT COUNT(*)::int AS c FROM ${table} ${where}`, params),
      ]),
    );
    return {
      columns,
      rows: rows.rows.map(serializeRow),
      total: count.rows[0].c as number,
      ms: Date.now() - started,
    };
  }

  async updateRow(query: UpdateQuery): Promise<UpdateResult> {
    const started = Date.now();
    const schema = query.schema || "public";
    const table = `${quotePg(schema)}.${quotePg(query.table)}`;
    const setCols = Object.keys(query.values);
    const keyCols = Object.keys(query.key);
    if (setCols.length === 0) throw new Error("Nothing to update");
    if (keyCols.length === 0) throw new Error("No key columns provided");

    const params: unknown[] = [];
    const setSql = setCols
      .map((column) => {
        params.push(query.values[column]);
        return `${quotePg(column)} = $${params.length}`;
      })
      .join(", ");
    const whereSql = keyCols
      .map((column) => {
        if (query.key[column] === null || query.key[column] === undefined) {
          return `${quotePg(column)} IS NULL`;
        }
        params.push(query.key[column]);
        return `${quotePg(column)} = $${params.length}`;
      })
      .join(" AND ");

    return this.withClient(async (client) => {
      let committed = false;
      try {
        await client.query("BEGIN");
        const res = await client.query(`UPDATE ${table} SET ${setSql} WHERE ${whereSql}`, params);
        const affected = res.rowCount ?? 0;
        if (affected !== 1) {
          await client.query("ROLLBACK");
          throw new Error(
            affected === 0
              ? "Row not found — it may have been changed or deleted"
              : `Refusing to update ${affected} rows (no unique key)`,
          );
        }
        await client.query("COMMIT");
        committed = true;
        return { updated: affected, ms: Date.now() - started };
      } finally {
        if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      }
    });
  }

  async query(sql: string): Promise<QueryResult> {
    const started = Date.now();
    return this.withClient(async (client) => {
      const notices: string[] = [];
      const onNotice = (notice: { message?: string }) => {
        if (notice.message) notices.push(notice.message);
      };
      client.on("notice", onNotice);
      try {
        const res = await client.query(sql);
        return {
          columns: (res.fields ?? []).map((field) => ({
            name: field.name,
            type: String(field.dataTypeID),
          })),
          rows: res.rows.map(serializeRow),
          rowCount: res.rowCount ?? res.rows.length,
          ms: Date.now() - started,
          notices: notices.length > 0 ? notices : undefined,
        };
      } finally {
        client.removeListener("notice", onNotice);
      }
    });
  }

  async close(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}
