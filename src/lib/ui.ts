import type { DbType } from "@/lib/types";

export const DB_META: Record<DbType, { label: string; short: string; color: string; defaultPort: number }> = {
  postgres: { label: "PostgreSQL", short: "PG", color: "#1f1f1f", defaultPort: 5432 },
  mysql: { label: "MySQL / MariaDB", short: "MY", color: "#1f1f1f", defaultPort: 3306 },
  mssql: { label: "SQL Server", short: "MS", color: "#1f1f1f", defaultPort: 1433 },
  sqlite: { label: "SQLite", short: "SQ", color: "#1f1f1f", defaultPort: 0 },
};

export const DB_TYPES: DbType[] = ["postgres", "mysql", "mssql", "sqlite"];

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function coerceValue(original: unknown, text: string): unknown {
  if (typeof original === "number") {
    const parsed = Number(text);
    return text.trim() !== "" && Number.isFinite(parsed) ? parsed : text;
  }
  if (typeof original === "boolean") {
    const lowered = text.trim().toLowerCase();
    if (["true", "1", "t", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "f", "no", "n"].includes(lowered)) return false;
    return text;
  }
  if (text === "") return original === null || original === undefined ? null : "";
  return text;
}
