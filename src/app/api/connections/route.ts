import { deleteConnection, listConnections, saveConnection } from "@/lib/connections";
import { closeSessionsByConnection } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import type { ConnConfig } from "@/lib/types";

export async function GET(): Promise<Response> {
  return ok({ connections: listConnections() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Omit<ConnConfig, "id"> & { id?: string };
    if (!body?.type) return fail("Database type is required");
    const saved = saveConnection(body);
    return ok({ connection: { ...saved, password: undefined, hasPassword: !!body.password } });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      await closeSessionsByConnection(id);
      deleteConnection(id);
    }
    return ok({ deleted: id });
  } catch (error) {
    return fail(error);
  }
}
