import mysql from "mysql2/promise";
import type { SqlDriver, RowQuery, UpdateQuery, UpdateResult } from "./interface";
import type { ColumnInfo, ConnConfig, QueryResult, RowResult, TableInfo } from "@/lib/types";
import { assertIdent, escapeLike, LIKE_ESCAPE, quoteMy } from "./ident";
import { serializeRow } from "./serialize";

type Meta = { name: string; type?: string; columnType?: number };

export class MysqlDriver implements SqlDriver {
  private pool: mysql.Pool;

  constructor(public readonly config: ConnConfig) {
    this.pool = mysql.createPool({
      host: config.host || "localhost",
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database || undefined,
      waitForConnections: true,
      connectionLimit: 4,
      connectTimeout: 8000,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      supportBigNumbers: true,
      decimalNumbers: true,
    });
  }

  private dbName(schema?: string): string {
    const name = schema || this.config.database;
    if (!name) throw new Error("No database selected");
    return name;
  }

  async test(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.pool.query("SHOW DATABASES");
    return (rows as Record<string, string>[]).map((row) => Object.values(row)[0]);
  }

  async listTables(database?: string): Promise<TableInfo[]> {
    const db = database || this.config.database;
    if (!db) return [];
    const [rows] = await this.pool.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE' AND table_schema = ?
       ORDER BY table_name`,
      [db],
    );
    return (rows as Record<string, string>[]).map((row) => ({
      schema: row.table_schema,
      name: row.table_name,
    }));
  }

  async getColumns(table: string, schema?: string): Promise<ColumnInfo[]> {
    assertIdent(table);
    const db = this.dbName(schema);
    const [rows] = await this.pool.query(
      `SELECT column_name, column_type, is_nullable, column_default, column_key
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      [db, table],
    );
    return (rows as Record<string, string>[]).map((row) => ({
      name: row.column_name,
      type: row.column_type,
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default ?? null,
      isPrimaryKey: row.column_key === "PRI",
    }));
  }

  async getRows(query: RowQuery): Promise<RowResult> {
    const started = Date.now();
    const db = this.dbName(query.schema);
    const table = `${quoteMy(db)}.${quoteMy(query.table)}`;
    const order = query.orderBy
      ? `ORDER BY ${quoteMy(query.orderBy)} ${query.orderDir === "desc" ? "DESC" : "ASC"}`
      : "";
    const columns = await this.getColumns(query.table, db);
    const term = query.search?.trim();
    const params: unknown[] = [];
    let where = "";
    if (term && columns.length > 0) {
      params.push(`%${escapeLike(term)}%`);
      const haystack = `CONCAT_WS(' ', ${columns
        .map((column) => `CAST(${quoteMy(column.name)} AS CHAR)`)
        .join(", ")})`;
      where = `WHERE ${haystack} LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
    }
    const [rows, count] = await Promise.all([
      this.pool.query(`SELECT * FROM ${table} ${where} ${order} LIMIT ? OFFSET ?`, [
        ...params,
        query.limit,
        query.offset,
      ]),
      this.pool.query(`SELECT COUNT(*) AS c FROM ${table} ${where}`, params),
    ]);
    const typed = rows as [Record<string, unknown>[], unknown];
    const counts = count as [Record<string, unknown>[], unknown];
    return {
      columns,
      rows: (typed[0] ?? []).map(serializeRow),
      total: Number(counts[0][0].c),
      ms: Date.now() - started,
    };
  }

  async updateRow(query: UpdateQuery): Promise<UpdateResult> {
    const started = Date.now();
    const db = this.dbName(query.schema);
    const table = `${quoteMy(db)}.${quoteMy(query.table)}`;
    const setCols = Object.keys(query.values);
    const keyCols = Object.keys(query.key);
    if (setCols.length === 0) throw new Error("Nothing to update");
    if (keyCols.length === 0) throw new Error("No key columns provided");

    const params: unknown[] = [];
    const setSql = setCols
      .map((column) => {
        params.push(query.values[column]);
        return `${quoteMy(column)} = ?`;
      })
      .join(", ");
    const whereSql = keyCols
      .map((column) => {
        if (query.key[column] === null || query.key[column] === undefined) {
          return `${quoteMy(column)} IS NULL`;
        }
        params.push(query.key[column]);
        return `${quoteMy(column)} = ?`;
      })
      .join(" AND ");

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(`UPDATE ${table} SET ${setSql} WHERE ${whereSql}`, params);
      const affected = (result as mysql.ResultSetHeader).affectedRows ?? 0;
      if (affected !== 1) {
        await connection.rollback();
        throw new Error(
          affected === 0
            ? "Row not found — it may have been changed or deleted"
            : `Refusing to update ${affected} rows (no unique key)`,
        );
      }
      await connection.commit();
      return { updated: affected, ms: Date.now() - started };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async query(sql: string): Promise<QueryResult> {
    const started = Date.now();
    const [rows, fields] = await this.pool.query(sql);
    const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    const meta = (fields as Meta[] | undefined) ?? [];
    return {
      columns: meta.map((field) => ({ name: field.name, type: field.type ?? "unknown" })),
      rows: list.map(serializeRow),
      rowCount: list.length,
      ms: Date.now() - started,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
