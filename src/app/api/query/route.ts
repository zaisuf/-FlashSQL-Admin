import { getDriver } from "@/lib/session";
import { fail, ok, readSid } from "@/lib/api";
import { splitStatements } from "@/lib/db/statements";
import type { QueryResult, StatementResult } from "@/lib/types";

function label(statement: string): string {
  const firstLine = statement.split("\n")[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  try {
    const sid = await readSid();
    const body = (await request.json()) as { sql?: string; database?: string };
    if (!body.sql?.trim()) return fail("SQL text is required");

    const statements = splitStatements(body.sql);
    if (statements.length === 0) return fail("SQL text is required");

    const driver = getDriver(sid, body.database);
    const results: StatementResult[] = [];
    let last: QueryResult | null = null;

    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      try {
        const result = await driver.query(statement);
        last = result;
        results.push({
          sql: statement,
          rowCount: result.rowCount,
          ms: result.ms,
          notices: result.notices,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const prefix = statements.length > 1 ? `Statement ${index + 1} of ${statements.length}: ` : "";
        return fail(`${prefix}${message}`);
      }
    }

    return ok({
      columns: last?.columns ?? [],
      rows: last?.rows ?? [],
      rowCount: last?.rowCount ?? 0,
      ms: Date.now() - started,
      statements: results,
      statementCount: statements.length,
    });
  } catch (error) {
    return fail(error);
  }
}
