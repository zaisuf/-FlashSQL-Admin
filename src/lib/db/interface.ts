import type { ColumnInfo, ConnConfig, QueryResult, RowResult, TableInfo } from "@/lib/types";

export interface RowQuery {
  table: string;
  schema?: string;
  limit: number;
  offset: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  search?: string;
}

export interface UpdateQuery {
  table: string;
  schema?: string;
  key: Record<string, unknown>;
  values: Record<string, unknown>;
}

export interface UpdateResult {
  updated: number;
  ms: number;
}

export interface SqlDriver {
  readonly config: ConnConfig;
  test(): Promise<void>;
  listDatabases(): Promise<string[]>;
  listTables(database?: string, schema?: string): Promise<TableInfo[]>;
  getColumns(table: string, schema?: string): Promise<ColumnInfo[]>;
  getRows(query: RowQuery): Promise<RowResult>;
  updateRow(query: UpdateQuery): Promise<UpdateResult>;
  query(sql: string): Promise<QueryResult>;
  close(): Promise<void>;
}
