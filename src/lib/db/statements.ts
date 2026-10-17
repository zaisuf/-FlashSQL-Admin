export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let index = 0;
  const length = sql.length;
  let dollarTag: string | null = null;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) out.push(trimmed);
    current = "";
  };

  while (index < length) {
    const char = sql[index];

    if (!dollarTag && sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index);
      const stop = end === -1 ? length : end;
      current += sql.slice(index, stop);
      index = stop;
      continue;
    }

    if (!dollarTag && sql.startsWith("/*", index)) {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? length : end + 2;
      current += sql.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "$") {
      if (dollarTag) {
        if (sql.startsWith(dollarTag, index)) {
          current += dollarTag;
          index += dollarTag.length;
          dollarTag = null;
          continue;
        }
      } else {
        const match = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
        if (match) {
          dollarTag = match[0];
          current += dollarTag;
          index += dollarTag.length;
          continue;
        }
      }
    }

    if (!dollarTag && (char === "'" || char === '"' || char === "`")) {
      current += char;
      index += 1;
      while (index < length) {
        const inner = sql[index];
        if (inner === char) {
          if (sql[index + 1] === char) {
            current += inner + inner;
            index += 2;
            continue;
          }
          current += inner;
          index += 1;
          break;
        }
        current += inner;
        index += 1;
      }
      continue;
    }

    if (char === ";" && !dollarTag) {
      flush();
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  flush();
  return out;
}
