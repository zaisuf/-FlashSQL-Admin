import { getDriver } from "@/lib/session";
import { fail, ok, readSid } from "@/lib/api";

interface UpdateBody {
  database?: string;
  schema?: string;
  table?: string;
  key?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const sid = await readSid();
    const body = (await request.json()) as UpdateBody;
    if (!body.table) return fail("table is required");
    if (!body.values || Object.keys(body.values).length === 0) {
      return fail("values are required");
    }
    const driver = getDriver(sid, body.database);
    const result = await driver.updateRow({
      table: body.table,
      schema: body.schema,
      key: body.key ?? {},
      values: body.values,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
