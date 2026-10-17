import { getDriver } from "@/lib/session";
import { fail, ok, parseLimit, readSid } from "@/lib/api";

interface RowsBody {
  database?: string;
  schema?: string;
  table?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  search?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const sid = await readSid();
    const body = (await request.json()) as RowsBody;
    if (!body.table) return fail("table is required");
    const driver = getDriver(sid, body.database);
    const result = await driver.getRows({
      table: body.table,
      schema: body.schema,
      limit: parseLimit(body.limit, 100, 1000),
      offset: Math.max(0, Math.floor(Number(body.offset) || 0)),
      orderBy: body.orderBy,
      orderDir: body.orderDir === "desc" ? "desc" : "asc",
      search: typeof body.search === "string" ? body.search.slice(0, 200) : undefined,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
