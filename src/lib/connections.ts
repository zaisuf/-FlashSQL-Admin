import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, ensureDir, encrypt, decrypt } from "./crypto";
import type { ConnConfig, StoredConnection } from "./types";

interface StoredRecord extends Omit<ConnConfig, "password"> {
  id: string;
  name: string;
  password?: string;
}

interface StoredFile {
  connections: StoredRecord[];
}

const filePath = path.join(dataDir, "connections.json");

function read(): StoredFile {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredFile;
  } catch {
    return { connections: [] };
  }
}

function write(data: StoredFile) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function listConnections(): StoredConnection[] {
  return read().connections.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    host: c.host,
    port: c.port,
    user: c.user,
    database: c.database,
    ssl: c.ssl,
    filePath: c.filePath,
    hasPassword: !!c.password,
  }));
}

export function getConnection(id: string): ConnConfig | null {
  const found = read().connections.find((c) => c.id === id);
  if (!found) return null;
  return {
    ...found,
    password: found.password ? decrypt(found.password) : undefined,
  } as ConnConfig;
}

function identity(input: {
  type: string;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  filePath?: string;
}): string {
  if (input.type === "sqlite") {
    return `sqlite|${(input.filePath ?? "").trim().toLowerCase()}`;
  }
  return [
    input.type,
    (input.host ?? "").trim().toLowerCase(),
    input.port ?? "",
    (input.user ?? "").trim().toLowerCase(),
    (input.database ?? "").trim().toLowerCase(),
  ].join("|");
}

export function saveConnection(input: Omit<ConnConfig, "id"> & { id?: string }): ConnConfig {
  const data = read();
  let id = input.id;
  if (!id) {
    const match = data.connections.find((c) => identity(c) === identity(input));
    id = match?.id ?? crypto.randomUUID();
  }
  const index = data.connections.findIndex((c) => c.id === id);
  const existing = index >= 0 ? data.connections[index] : undefined;

  let password = existing?.password;
  if (input.password) password = encrypt(input.password);

  const record: StoredRecord = {
    id,
    name: input.name?.trim() || `${input.type}-${id.slice(0, 4)}`,
    type: input.type,
    host: input.host,
    port: input.port,
    user: input.user,
    database: input.database,
    ssl: input.ssl,
    filePath: input.filePath,
    password,
  };

  if (index >= 0) data.connections[index] = record;
  else data.connections.push(record);
  write(data);

  return { ...record, password: input.password } as ConnConfig;
}

export function deleteConnection(id: string) {
  const data = read();
  data.connections = data.connections.filter((c) => c.id !== id);
  write(data);
}
