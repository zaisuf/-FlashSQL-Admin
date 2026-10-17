import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createDriver } from "@/lib/db";
import { getConnection, saveConnection } from "@/lib/connections";
import {
  adoptPersistedSessions,
  closeAllSessions,
  closeSession,
  createSession,
  findSessionByConnection,
  listSessionInfos,
  sessionInfo,
  SID_COOKIE,
  SID_LIST_COOKIE,
} from "@/lib/session";
import { fail } from "@/lib/api";
import type { ConnConfig } from "@/lib/types";

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };

function parseList(raw?: string): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function withCookies(data: unknown, reply: NextResponse, sids: string[], activeSid: string | null) {
  reply.cookies.set(SID_LIST_COOKIE, sids.join(","), {
    ...COOKIE_OPTIONS,
    maxAge: sids.length ? COOKIE_OPTIONS.maxAge : 0,
  });
  reply.cookies.set(SID_COOKIE, activeSid ?? "", {
    ...COOKIE_OPTIONS,
    maxAge: activeSid ? COOKIE_OPTIONS.maxAge : 0,
  });
  return reply;
}

export async function GET(): Promise<Response> {
  const store = await cookies();
  const list = parseList(store.get(SID_LIST_COOKIE)?.value);

  let sessions = listSessionInfos(list);

  if (sessions.length === 0) {
    sessions = listSessionInfos(adoptPersistedSessions());
  }

  const sids = sessions.map((session) => session.sid);
  const activeCookie = store.get(SID_COOKIE)?.value ?? null;
  const activeSid =
    activeCookie && sids.includes(activeCookie) ? activeCookie : (sids[0] ?? null);

  const reply = NextResponse.json({ sessions, activeSid });
  return withCookies({}, reply, sids, activeSid);
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  try {
    const body = (await request.json()) as { connectionId?: string; config?: ConnConfig };
    let config: ConnConfig | null = null;

    if (body.connectionId) {
      config = getConnection(body.connectionId);
      if (!config) return fail("Saved connection not found", 404);
    } else if (body.config?.type) {
      config = body.config;
    }
    if (!config) return fail("Connection configuration is required");

    let connectionId: string | undefined = body.connectionId;
    if (!connectionId) {
      connectionId = saveConnection(config).id;
    }

    const driver = createDriver(config);
    let databases: string[] = [];
    try {
      await driver.test();
      databases = await driver.listDatabases().catch(() => []);
    } finally {
      await driver.close().catch(() => undefined);
    }

    if (connectionId) {
      const existing = findSessionByConnection(connectionId);
      if (existing) await closeSession(existing);
    }

    const sid = createSession(config, databases, connectionId);
    const store = await cookies();
    const list = parseList(store.get(SID_LIST_COOKIE)?.value);
    if (!list.includes(sid)) list.push(sid);

    const reply = NextResponse.json({
      session: sessionInfo(sid),
      sessions: listSessionInfos(list),
      activeSid: sid,
      connectionId,
      ms: Date.now() - started,
    });
    return withCookies({}, reply, list, sid);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sid = url.searchParams.get("sid");
    const all = url.searchParams.get("all");
    const store = await cookies();

    let list = parseList(store.get(SID_LIST_COOKIE)?.value);
    const activeCookie = store.get(SID_COOKIE)?.value ?? null;
    let nextActive = activeCookie;

    if (all) {
      await closeAllSessions();
      list = [];
      nextActive = null;
    } else if (sid) {
      await closeSession(sid);
      list = list.filter((current) => current !== sid);
      if (activeCookie === sid) nextActive = list[0] ?? null;
    }

    const remaining = listSessionInfos(list);
    if (nextActive && !remaining.some((session) => session.sid === nextActive)) {
      nextActive = remaining[0]?.sid ?? null;
    }

    const reply = NextResponse.json({ sessions: remaining, activeSid: nextActive });
    return withCookies({}, reply, list, nextActive);
  } catch (error) {
    return fail(error);
  }
}
