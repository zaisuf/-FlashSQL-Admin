import { randomUUID } from "node:crypto";
import { createDriver } from "@/lib/db";
import type { SqlDriver } from "@/lib/db";
import {
  forgetAll,
  forgetByConnection,
  forgetSession,
  listPersistedSids,
  loadSession,
  persistSession,
} from "@/lib/session-store";
import type { ConnConfig, SessionInfo } from "@/lib/types";

interface SessionEntry {
  config: ConnConfig;
  databases: string[];
  drivers: Map<string, SqlDriver>;
  lastUsed: number;
  connectionId?: string;
}

const globalRef = globalThis as unknown as { __sqlaSessions?: Map<string, SessionEntry> };
const sessions: Map<string, SessionEntry> =
  globalRef.__sqlaSessions ?? (globalRef.__sqlaSessions = new Map<string, SessionEntry>());

export const SID_COOKIE = "sqla_sid";
export const SID_LIST_COOKIE = "sqla_sids";

export function createSession(
  config: ConnConfig,
  databases: string[] = [],
  connectionId?: string,
): string {
  const sid = randomUUID();
  sessions.set(sid, {
    config,
    databases,
    drivers: new Map(),
    lastUsed: Date.now(),
    connectionId,
  });
  persistSession(sid, config, databases, connectionId);
  return sid;
}

function restoreSession(sid: string): boolean {
  if (sessions.has(sid)) return true;
  const stored = loadSession(sid);
  if (!stored) return false;
  sessions.set(sid, {
    config: stored.config,
    databases: stored.databases,
    drivers: new Map(),
    lastUsed: Date.now(),
    connectionId: stored.connectionId,
  });
  return true;
}

export function adoptPersistedSessions(): string[] {
  const sids = listPersistedSids();
  return sids.filter((sid) => restoreSession(sid));
}

export function getSession(sid: string): SessionEntry | undefined {
  if (!sessions.has(sid)) restoreSession(sid);
  const entry = sessions.get(sid);
  if (entry) entry.lastUsed = Date.now();
  return entry;
}

export function getDriver(sid: string, database?: string): SqlDriver {
  const entry = getSession(sid);
  if (!entry) throw new Error("Session expired. Please reconnect.");
  const key = database || entry.config.database || "default";
  let driver = entry.drivers.get(key);
  if (!driver) {
    driver = createDriver({ ...entry.config, database: database || entry.config.database });
    entry.drivers.set(key, driver);
  }
  return driver;
}

export async function closeSession(sid: string): Promise<void> {
  const entry = sessions.get(sid);
  forgetSession(sid);
  if (!entry) return;
  await Promise.all(
    [...entry.drivers.values()].map((driver) => driver.close().catch(() => undefined)),
  );
  sessions.delete(sid);
}

export async function closeAllSessions(): Promise<void> {
  await Promise.all([...sessions.keys()].map((sid) => closeSession(sid)));
  forgetAll();
}

export async function closeSessionsByConnection(connectionId: string): Promise<void> {
  for (const [sid, entry] of sessions) {
    if (entry.connectionId === connectionId) await closeSession(sid);
  }
  forgetByConnection(connectionId);
}

export function findSessionByConnection(connectionId: string): string | null {
  for (const [sid, entry] of sessions) {
    if (entry.connectionId === connectionId) return sid;
  }
  for (const sid of listPersistedSids()) {
    if (sessions.has(sid)) continue;
    const stored = loadSession(sid);
    if (stored?.connectionId === connectionId) {
      forgetSession(sid);
    }
  }
  return null;
}

export function sessionInfo(sid: string): SessionInfo | null {
  const entry = getSession(sid);
  if (!entry) return null;
  return {
    sid,
    name: entry.config.name || entry.config.database || entry.config.type,
    type: entry.config.type,
    database: entry.config.database,
    databases: entry.databases,
    connectionId: entry.connectionId,
  };
}

export function listSessionInfos(sids: string[]): SessionInfo[] {
  return sids
    .map((sid) => sessionInfo(sid))
    .filter((info): info is SessionInfo => info !== null);
}
