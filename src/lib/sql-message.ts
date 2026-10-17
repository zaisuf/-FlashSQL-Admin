import type { QueryResult } from "@/lib/types";

export type MessageType = "success" | "error" | "warning" | "info";

export interface RunMessage {
  type: MessageType;
  title: string;
  detail?: string;
}

const VERB = /^\s*(create|alter|drop|truncate|insert|update|delete|select|with|grant|revoke|refresh|set|do|call|copy|begin|commit|rollback)\b/i;

function targetName(sql: string): string {
  const match =
    /\b(?:table|into|from|update|view|index)\s+(?:if\s+(?:not\s+)?exists\s+)?["`[]?([A-Za-z_][A-Za-z0-9_$]*)/i.exec(
      sql,
    );
  return match ? `"${match[1]}"` : "";
}

function rows(count: number): string {
  return `${count} row${count === 1 ? "" : "s"}`;
}

function alreadyExists(notices?: string[]): string | null {
  const hit = (notices ?? []).find((notice) => /already exists/i.test(notice));
  return hit ?? null;
}

export function describeRun(result: QueryResult): RunMessage {
  const statements = result.statements ?? [];
  const count = result.statementCount ?? statements.length ?? 1;

  if (count > 1) {
    const noticed = statements.flatMap((statement) => statement.notices ?? []);
    const exists = alreadyExists(noticed);
    return {
      type: "success",
      title: `${count} statements executed successfully`,
      detail: exists ? `${exists} · ${result.ms}ms` : `${result.ms}ms`,
    };
  }

  const single = statements[0];
  const sql = single?.sql ?? "";
  const affected = single?.rowCount ?? result.rowCount;
  const verb = (VERB.exec(sql)?.[1] ?? "").toLowerCase();
  const target = targetName(sql);
  const notice = alreadyExists(single?.notices);

  switch (verb) {
    case "create":
      if (/\bcreate\s+table\b/i.test(sql)) {
        if (notice) {
          return { type: "warning", title: `Table ${target} already exists`, detail: "Nothing was created." };
        }
        return { type: "success", title: `Table ${target} created` };
      }
      return { type: "success", title: "Object created" };
    case "alter":
      return { type: "success", title: `Table ${target} altered` };
    case "drop":
      return { type: "success", title: `Table ${target} dropped` };
    case "truncate":
      return { type: "success", title: `Table ${target} truncated` };
    case "insert":
      if (affected === 0 && /\bon\s+conflict\b/i.test(sql)) {
        return { type: "warning", title: "Row already exists", detail: "Skipped by ON CONFLICT." };
      }
      return { type: "success", title: `${rows(affected)} added` };
    case "update":
      if (affected === 0) return { type: "info", title: "No rows matched", detail: "0 rows updated." };
      return { type: "success", title: `${rows(affected)} updated` };
    case "delete":
      if (affected === 0) return { type: "info", title: "No rows matched", detail: "0 rows deleted." };
      return { type: "success", title: `${rows(affected)} deleted` };
    case "select":
    case "with":
      return { type: "success", title: `${rows(affected)} returned`, detail: `${result.ms}ms` };
    default:
      return { type: "success", title: "Command executed successfully", detail: `${result.ms}ms` };
  }
}

export function describeError(error: unknown): RunMessage {
  const raw = error instanceof Error ? error.message : String(error);
  if (/connection timeout|Connection terminated|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|terminating connection|server closed the connection/i.test(raw)) {
    return {
      type: "error",
      title: "Connection lost",
      detail: `${raw} — the database may have been idle (Neon auto-suspends). Run it again to reconnect.`,
    };
  }
  if (/timeout|canceling statement due to statement timeout/i.test(raw)) {
    return { type: "error", title: "Query timed out", detail: raw };
  }
  if (/already exists/i.test(raw)) {
    return { type: "warning", title: "Already exists", detail: raw };
  }
  if (/does not exist|no such (table|column)|unknown (table|column)|undefined (table|column)/i.test(raw)) {
    return { type: "error", title: "Not found", detail: raw };
  }
  if (/duplicate key|unique constraint|duplicate entry/i.test(raw)) {
    return { type: "warning", title: "Duplicate value", detail: raw };
  }
  if (/syntax error|near "/i.test(raw)) {
    return { type: "error", title: "Syntax error", detail: raw };
  }
  if (/permission denied|access denied/i.test(raw)) {
    return { type: "error", title: "Permission denied", detail: raw };
  }
  return { type: "error", title: "Query failed", detail: raw };
}
