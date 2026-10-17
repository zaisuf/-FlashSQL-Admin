import fs from "node:fs";
import path from "node:path";
import { dataDir, ensureDir, encrypt, decrypt } from "./crypto";
import type { ConnConfig, DbType } from "./types";

interface PersistedRecord {
  sid: string;
  connectionId?: string;
  name: string;
  type: DbType;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  ssl?: boolean;
  filePath?: string;
  password?: string;
  databases: string[];
  openedAt: number;
}

interface PersistedFile {
  sessions: PersistedRecord[];
}

export interface RestoredSession {
  config: ConnConfig;
  databases: string[];
  connectionId?: string;
}

const filePath = path.join(dataDir, "sessions.json");

function read(): PersistedFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedFile;
    return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

function write(data: PersistedFile) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function safeDecrypt(payload: string): string | undefined {
  try {
    return decrypt(payload);
  } catch {
    return undefined;
  }
}

export function persistSession(
  sid: string,
  config: ConnConfig,
  databases: string[],
  connectionId?: string,
) {
  const data = read();
  const record: PersistedRecord = {
    sid,
    connectionId,
    name: config.name?.trim() || config.database || config.type,
    type: config.type,
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    ssl: config.ssl,
    filePath: config.filePath,
    password: config.password ? encrypt(config.password) : undefined,
    databases: databases ?? [],
    openedAt: Date.now(),
  };
  data.sessions = data.sessions.filter((entry) => entry.sid !== sid);
  data.sessions.push(record);
  write(data);
}

export function loadSession(sid: string): RestoredSession | null {
  const found = read().sessions.find((entry) => entry.sid === sid);
  if (!found) return null;
  return {
    connectionId: found.connectionId,
    databases: found.databases ?? [],
    config: {
      id: found.connectionId,
      name: found.name,
      type: found.type,
      host: found.host,
      port: found.port,
      user: found.user,
      database: found.database,
      ssl: found.ssl,
      filePath: found.filePath,
      password: found.password ? safeDecrypt(found.password) : undefined,
    },
  };
}

export function listPersistedSids(): string[] {
  return read()
    .sessions.slice()
    .sort((a, b) => a.openedAt - b.openedAt)
    .map((entry) => entry.sid);
}

export function forgetSession(sid: string) {
  const data = read();
  const next = data.sessions.filter((entry) => entry.sid !== sid);
  if (next.length !== data.sessions.length) {
    data.sessions = next;
    write(data);
  }
}

export function forgetByConnection(connectionId: string) {
  const data = read();
  const next = data.sessions.filter((entry) => entry.connectionId !== connectionId);
  if (next.length !== data.sessions.length) {
    data.sessions = next;
    write(data);
  }
}

export function forgetAll() {
  write({ sessions: [] });
}
