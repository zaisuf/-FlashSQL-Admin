export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `0x${value.toString("hex")}`;
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (typeof value === "object") {
    const maybe = value as { toJSON?: () => unknown };
    if (typeof maybe.toJSON === "function") {
      try {
        return maybe.toJSON();
      } catch {
        return String(value);
      }
    }
  }
  return value;
}

export function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = serializeValue(value);
  return out;
}
