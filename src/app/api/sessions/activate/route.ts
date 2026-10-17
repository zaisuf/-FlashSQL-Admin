import { NextResponse } from "next/server";
import { getSession, sessionInfo, SID_COOKIE } from "@/lib/session";
import { fail } from "@/lib/api";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { sid?: string };
    if (!body.sid || !getSession(body.sid)) return fail("Session not found or expired", 404);
    const response = NextResponse.json({ activeSid: body.sid, session: sessionInfo(body.sid) });
    response.cookies.set(SID_COOKIE, body.sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}
