export type DbType = "postgres" | "mysql" | "mssql" | "sqlite";

export interface ConnConfig {
  id?: string;
  name?: string;
  type: DbType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  filePath?: string;
}

export interface StoredConnection {
  id: string;
  name: string;
  type: DbType;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  ssl?: boolean;
  filePath?: string;
  hasPassword: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface RowResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  ms: number;
}

export interface StatementResult {
  sql: string;
  rowCount: number;
  ms: number;
  notices?: string[];
}

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  ms: number;
  notices?: string[];
  statements?: StatementResult[];
  statementCount?: number;
}

export interface SessionInfo {
  sid: string;
  name: string;
  type: DbType;
  database?: string;
  databases: string[];
  connectionId?: string;
}

export type LogLevel = "info" | "error" | "query";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  ms?: number;
  rows?: number;
  at: number;
}
