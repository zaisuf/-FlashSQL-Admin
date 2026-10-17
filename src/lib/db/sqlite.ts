import Database from "better-sqlite3";
import type { SqlDriver, RowQuery, UpdateQuery, UpdateResult } from "./interface";
import type { ColumnInfo, ConnConfig, QueryResult, RowResult, TableInfo } from "@/lib/types";
import { assertIdent, escapeLike, LIKE_ESCAPE, quoteSq } from "./ident";
import { serializeRow } from "./serialize";

interface PragmaRow {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

function bindValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

export class SqliteDriver implements SqlDriver {
  private db: Database.Database;

  constructor(public readonly config: ConnConfig) {
    if (!config.filePath) throw new Error("SQLite requires a file path");
    this.db = new Database(config.filePath, { fileMustExist: true });
  }

  async test(): Promise<void> {
    this.db.prepare("SELECT 1").get();
  }

  async listDatabases(): Promise<string[]> {
    return ["main"];
  }

  async listTables(): Promise<TableInfo[]> {
    const rows = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return rows.map((row) => ({ schema: "main", name: row.name }));
  }

  async getColumns(table: string): Promise<ColumnInfo[]> {
    assertIdent(table);
    const rows = this.db.prepare(`PRAGMA table_info(${quoteSq(table)})`).all() as PragmaRow[];
    return rows.map((row) => ({
      name: row.name,
      type: row.type || "unknown",
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      isPrimaryKey: row.pk > 0,
    }));
  }

  async getRows(query: RowQuery): Promise<RowResult> {
    const started = Date.now();
    const table = quoteSq(query.table);
    const order = query.orderBy
      ? `ORDER BY ${quoteSq(query.orderBy)} ${query.orderDir === "desc" ? "DESC" : "ASC"}`
      : "";
    const columns = await this.getColumns(query.table);
    const term = query.search?.trim();
    let where = "";
    const params: unknown[] = [];
    if (term && columns.length > 0) {
      params.push(`%${escapeLike(term)}%`);
      const haystack = columns
        .map((column) => `COALESCE(CAST(${quoteSq(column.name)} AS TEXT), '')`)
        .join(" || ' ' || ");
      where = `WHERE ${haystack} LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
    }
    const rows = this.db
      .prepare(`SELECT * FROM ${table} ${where} ${order} LIMIT ? OFFSET ?`)
      .all(...params, query.limit, query.offset) as Record<string, unknown>[];
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get(...params) as { c: number }
    ).c;
    return { columns, rows: rows.map(serializeRow), total, ms: Date.now() - started };
  }

  async updateRow(query: UpdateQuery): Promise<UpdateResult> {
    const started = Date.now();
    const table = quoteSq(query.table);
    const setCols = Object.keys(query.values);
    const keyCols = Object.keys(query.key);
    if (setCols.length === 0) throw new Error("Nothing to update");
    if (keyCols.length === 0) throw new Error("No key columns provided");

    const params: unknown[] = [];
    const setSql = setCols
      .map((column) => {
        params.push(bindValue(query.values[column]));
        return `${quoteSq(column)} = ?`;
      })
      .join(", ");
    const whereSql = keyCols
      .map((column) => {
        if (query.key[column] === null || query.key[column] === undefined) {
          return `${quoteSq(column)} IS NULL`;
        }
        params.push(bindValue(query.key[column]));
        return `${quoteSq(column)} = ?`;
      })
      .join(" AND ");

    const statement = this.db.prepare(`UPDATE ${table} SET ${setSql} WHERE ${whereSql}`);
    const run = this.db.transaction(() => {
      const info = statement.run(...params);
      if (info.changes !== 1) {
        throw new Error(
          info.changes === 0
            ? "Row not found — it may have been changed or deleted"
            : `Refusing to update ${info.changes} rows (no unique key)`,
        );
      }
      return info.changes;
    });

    const updated = run();
    return { updated, ms: Date.now() - started };
  }

  async query(sql: string): Promise<QueryResult> {
    const started = Date.now();
    const statement = this.db.prepare(sql);
    if (statement.reader) {
      const rows = statement.all() as Record<string, unknown>[];
      const columns = (statement.columns() as { name: string; type: string | null }[]).map((col) => ({
        name: col.name,
        type: col.type ?? "unknown",
      }));
      return { columns, rows: rows.map(serializeRow), rowCount: rows.length, ms: Date.now() - started };
    }
    const info = statement.run();
    return { columns: [], rows: [], rowCount: info.changes, ms: Date.now() - started };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
