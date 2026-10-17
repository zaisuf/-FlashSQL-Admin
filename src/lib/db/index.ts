import type { ConnConfig, DbType } from "@/lib/types";
import type { SqlDriver } from "./interface";
import { PostgresDriver } from "./postgres";
import { MysqlDriver } from "./mysql";
import { MssqlDriver } from "./mssql";
import { SqliteDriver } from "./sqlite";

export const DEFAULT_PORTS: Record<DbType, number | undefined> = {
  postgres: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: undefined,
};

export const DB_LABELS: Record<DbType, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  mssql: "SQL Server",
  sqlite: "SQLite",
};

export function createDriver(config: ConnConfig): SqlDriver {
  switch (config.type) {
    case "postgres":
      return new PostgresDriver(config);
    case "mysql":
      return new MysqlDriver(config);
    case "mssql":
      return new MssqlDriver(config);
    case "sqlite":
      return new SqliteDriver(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

export type { SqlDriver };
