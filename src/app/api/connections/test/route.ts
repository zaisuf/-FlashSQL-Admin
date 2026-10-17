import { createDriver } from "@/lib/db";
import { getConnection } from "@/lib/connections";
import { fail, ok } from "@/lib/api";
import type { ConnConfig } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  try {
    const body = (await request.json()) as ConnConfig & { id?: string };
    const config = body.id && !body.type ? getConnection(body.id) : body;
    if (!config?.type) return fail("Database configuration is required");
    const driver = createDriver(config);
    try {
      await driver.test();
      return ok({ ok: true, ms: Date.now() - started });
    } finally {
      await driver.close().catch(() => undefined);
    }
  } catch (error) {
    return fail(error);
  }
}
