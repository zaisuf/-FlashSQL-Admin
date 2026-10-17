import { getDriver } from "@/lib/session";
import { fail, ok, readSid } from "@/lib/api";

export async function GET(request: Request): Promise<Response> {
  try {
    const sid = await readSid();
    const url = new URL(request.url);
    const database = url.searchParams.get("database") ?? undefined;
    const schema = url.searchParams.get("schema") ?? undefined;
    const driver = getDriver(sid, database);
    const tables = await driver.listTables(database, schema);
    return ok({ tables });
  } catch (error) {
    return fail(error);
  }
}
