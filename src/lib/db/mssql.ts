import sql from "mssql";
import type { SqlDriver, RowQuery, UpdateQuery, UpdateResult } from "./interface";
import type { ColumnInfo, ConnConfig, QueryResult, RowResult, TableInfo } from "@/lib/types";
import { assertIdent, escapeLike, LIKE_ESCAPE, quoteMssql } from "./ident";
import { serializeRow } from "./serialize";

export class MssqlDriver implements SqlDriver {
  private pool: sql.ConnectionPool | null = null;

  constructor(public readonly config: ConnConfig) {}

  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) return this.pool;
    this.pool = await new sql.ConnectionPool({
      server: this.config.host || "localhost",
      port: this.config.port || 1433,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      options: {
        encrypt: this.config.ssl ?? true,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 8000,
      requestTimeout: 30000,
      pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
    }).connect();
    return this.pool;
  }

  async test(): Promise<void> {
    const pool = await this.getPool();
    await pool.request().query("SELECT 1");
  }

  async listDatabases(): Promise<string[]> {
    const pool = await this.getPool();
    const res = await pool.request().query("SELECT name FROM sys.databases ORDER BY name");
    return res.recordset.map((row: { name: string }) => row.name);
  }

  async listTables(database?: string): Promise<TableInfo[]> {
    const db = database || this.config.database;
    if (!db) return [];
    const pool = await this.getPool();
    const res = await pool
      .request()
      .input("db", sql.NVarChar, db)
      .query(
        `SELECT TABLE_SCHEMA, TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = @db
         ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      );
    return res.recordset.map((row: { TABLE_SCHEMA: string; TABLE_NAME: string }) => ({
      schema: row.TABLE_SCHEMA,
      name: row.TABLE_NAME,
    }));
  }

  async getColumns(table: string, schema = "dbo"): Promise<ColumnInfo[]> {
    assertIdent(table);
    assertIdent(schema);
    const pool = await this.getPool();
    const res = await pool
      .request()
      .input("s", sql.NVarChar, schema)
      .input("t", sql.NVarChar, table)
      .query(
        `SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
                CASE WHEN pk.COLUMN_NAME IS NULL THEN 0 ELSE 1 END AS IS_PK
         FROM INFORMATION_SCHEMA.COLUMNS c
         LEFT JOIN (
           SELECT kcu.COLUMN_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
           JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
             ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
           WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_NAME = @t
         ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
         WHERE c.TABLE_SCHEMA = @s AND c.TABLE_NAME = @t
         ORDER BY c.ORDINAL_POSITION`,
      );
    return res.recordset.map(
      (row: {
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
        IS_PK: number;
      }) => ({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === "YES",
        defaultValue: row.COLUMN_DEFAULT ?? null,
        isPrimaryKey: row.IS_PK === 1,
      }),
    );
  }

  async getRows(query: RowQuery): Promise<RowResult> {
    const started = Date.now();
    const schema = query.schema || "dbo";
    const table = `${quoteMssql(schema)}.${quoteMssql(query.table)}`;
    const order = query.orderBy
      ? `ORDER BY ${quoteMssql(query.orderBy)} ${query.orderDir === "desc" ? "DESC" : "ASC"}`
      : "ORDER BY (SELECT NULL)";
    const columns = await this.getColumns(query.table, schema);
    const term = query.search?.trim();
    let where = "";
    if (term && columns.length > 0) {
      const haystack = `CONCAT(${columns
        .map((column) => `CAST(${quoteMssql(column.name)} AS NVARCHAR(MAX))`)
        .join(", ")})`;
      where = `WHERE ${haystack} LIKE @search ESCAPE '${LIKE_ESCAPE}'`;
    }
    const pool = await this.getPool();
    const [rows, count] = await Promise.all([
      (() => {
        const request = pool
          .request()
          .input("off", sql.Int, query.offset)
          .input("lim", sql.Int, query.limit);
        if (where) request.input("search", sql.NVarChar, `%${escapeLike(term!)}%`);
        return request.query(
          `SELECT * FROM ${table} ${where} ${order} OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
        );
      })(),
      (() => {
        const request = pool.request();
        if (where) request.input("search", sql.NVarChar, `%${escapeLike(term!)}%`);
        return request.query(`SELECT COUNT_BIG(*) AS c FROM ${table} ${where}`);
      })(),
    ]);
    return {
      columns,
      rows: rows.recordset.map(serializeRow),
      total: Number(count.recordset[0].c),
      ms: Date.now() - started,
    };
  }

  async updateRow(query: UpdateQuery): Promise<UpdateResult> {
    const started = Date.now();
    const schema = query.schema || "dbo";
    const table = `${quoteMssql(schema)}.${quoteMssql(query.table)}`;
    const setCols = Object.keys(query.values);
    const keyCols = Object.keys(query.key);
    if (setCols.length === 0) throw new Error("Nothing to update");
    if (keyCols.length === 0) throw new Error("No key columns provided");

    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    let committed = false;
    try {
      const request = new sql.Request(transaction);
      const loose = request as unknown as {
        input: (name: string, typeOrValue: unknown, value?: unknown) => unknown;
      };
      const addInput = (name: string, value: unknown) => {
        if (value === null || value === undefined) loose.input(name, sql.NVarChar, null);
        else loose.input(name, value);
      };

      const setSql = setCols
        .map((column, index) => {
          const param = `s${index}`;
          addInput(param, query.values[column]);
          return `${quoteMssql(column)} = @${param}`;
        })
        .join(", ");
      const whereSql = keyCols
        .map((column, index) => {
          if (query.key[column] === null || query.key[column] === undefined) {
            return `${quoteMssql(column)} IS NULL`;
          }
          const param = `k${index}`;
          addInput(param, query.key[column]);
          return `${quoteMssql(column)} = @${param}`;
        })
        .join(" AND ");

      const res = await request.query(`UPDATE ${table} SET ${setSql} WHERE ${whereSql}`);
      const affected = (res.rowsAffected ?? []).reduce((sum, value) => sum + value, 0);
      if (affected !== 1) {
        await transaction.rollback();
        throw new Error(
          affected === 0
            ? "Row not found — it may have been changed or deleted"
            : `Refusing to update ${affected} rows (no unique key)`,
        );
      }
      await transaction.commit();
      committed = true;
      return { updated: affected, ms: Date.now() - started };
    } finally {
      if (!committed) await transaction.rollback().catch(() => undefined);
    }
  }

  async query(sqlText: string): Promise<QueryResult> {
    const started = Date.now();
    const pool = await this.getPool();
    const res = await pool.request().query(sqlText);
    const columns = Object.entries(res.recordset?.columns ?? {}).map(([name, meta]) => {
      const typed = meta as { type?: { name?: string } };
      return { name, type: typed.type?.name ?? "unknown" };
    });
    const rows = res.recordset ?? [];
    return {
      columns,
      rows: rows.map(serializeRow),
      rowCount: res.rowsAffected?.[0] ?? rows.length,
      ms: Date.now() - started,
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }
}
