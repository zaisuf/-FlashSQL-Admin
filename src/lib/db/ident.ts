const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function assertIdent(name: string): string {
  if (!SAFE_IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

export function quotePg(name: string) {
  return `"${assertIdent(name)}"`;
}

export function quoteMy(name: string) {
  return `\`${assertIdent(name)}\``;
}

export function quoteMssql(name: string) {
  return `[${assertIdent(name)}]`;
}

export function quoteSq(name: string) {
  return `"${assertIdent(name)}"`;
}

export const LIKE_ESCAPE = "!";

export function escapeLike(term: string): string {
  return term.replace(/[!%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
}
