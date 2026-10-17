import { getDriver } from "@/lib/session";
import { fail, ok, readSid } from "@/lib/api";

export async function GET(request: Request): Promise<Response> {
  try {
    const sid = await readSid();
    const url = new URL(request.url);
    const table = url.searchParams.get("table");
    if (!table) return fail("table parameter is required");
    const database = url.searchParams.get("database") ?? undefined;
    const schema = url.searchParams.get("schema") ?? undefined;
    const driver = getDriver(sid, database);
    const columns = await driver.getColumns(table, schema);
    return ok({ columns });
  } catch (error) {
    return fail(error);
  }
}
