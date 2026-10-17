import { cookies } from "next/headers";
import { SID_COOKIE } from "@/lib/session";

export async function readSid(): Promise<string> {
  const store = await cookies();
  const sid = store.get(SID_COOKIE)?.value;
  if (!sid) throw new Error("Not connected. Please connect to a database.");
  return sid;
}

export function fail(error: unknown, status = 400): Response {
  let message = "";
  if (error instanceof Error) message = error.message;
  else if (typeof error === "string") message = error;
  else if (error && typeof error === "object") {
    const record = error as { message?: unknown };
    message = typeof record.message === "string" ? record.message : "";
    if (!message) {
      try {
        message = JSON.stringify(error);
      } catch {
        message = "";
      }
    }
  }
  return Response.json({ error: message || "Unexpected database error" }, { status });
}

export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function parseLimit(value: unknown, fallback: number, max: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}
