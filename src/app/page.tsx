"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutPanelLeft, Plus, Server, Trash2, Zap } from "lucide-react";
import type { SessionInfo, StoredConnection } from "@/lib/types";
import { DB_META, classNames } from "@/lib/ui";

export default function HomePage() {
  const router = useRouter();
  const [connections, setConnections] = useState<StoredConnection[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [connectionsRes, sessionsRes] = await Promise.all([
        fetch("/api/connections"),
        fetch("/api/sessions"),
      ]);
      const connectionsData = await connectionsRes.json();
      const sessionsData = await sessionsRes.json();
      setConnections(connectionsData.connections ?? []);
      setSessions(sessionsData.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function connect(connection: StoredConnection) {
    setBusy(connection.id);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function openSession(session: SessionInfo) {
    setBusy(session.connectionId ?? session.sid);
    setError(null);
    try {
      await fetch("/api/sessions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid: session.sid }),
      });
      router.push("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  async function remove(connection: StoredConnection) {
    if (!confirm(`Delete saved connection "${connection.name}"?`)) return;
    await fetch(`/api/connections?id=${connection.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/flash-logo.png"
            alt="Flash SQL Studio"
            width={44}
            height={44}
            className="h-11 w-11"
          />
          <h1 className="display text-3xl leading-none text-[#f5f5f5]">Flash SQL Studio</h1>
        </div>
        <button
          onClick={() => router.push("/connect")}
          className="flex items-center gap-2 rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c]"
        >
          <Plus size={16} />
          New connection
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-[#4a1f1f] bg-[#241010] px-4 py-3 text-sm text-[#ff8f8f]">
          {error}
        </div>
      )}

      {sessions.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ff5a1f]/40 bg-[#ff5a1f]/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5a1f]/20 text-[#ff5a1f]">
              <LayoutPanelLeft size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#f5f5f5]">
                {sessions.length === 1
                  ? `1 database is ready: ${sessions[0].name}`
                  : `${sessions.length} databases are ready`}
              </p>
              <p className="text-xs text-[#8a8a8a]">
                Your connections were kept open — nothing to re-enter.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/workspace")}
            className="flex items-center gap-2 rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c]"
          >
            <Zap size={15} />
            Open workspace
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8a8a8a]">
          Saved connections
        </h2>

        {loading ? (
          <p className="text-sm text-[#8a8a8a]">Loading…</p>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#262626] bg-[#141414] px-6 py-14 text-center">
            <Server size={28} className="text-[#8a8a8a]" />
            <p className="text-sm text-[#8a8a8a]">
              No connections yet. Add PostgreSQL, MySQL, SQL Server or SQLite.
            </p>
            <button
              onClick={() => router.push("/connect")}
              className="rounded-full border border-[#262626] px-5 py-2 text-sm text-[#d4d4d4] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
            >
              Add your first connection
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((connection) => {
              const meta = DB_META[connection.type];
              const live = sessions.find((session) => session.connectionId === connection.id);
              const isBusy = busy === connection.id || (live && busy === live.connectionId);
              return (
                <div
                  key={connection.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-[#262626] bg-[#141414] p-4 transition hover:border-[#3a3a3a]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.short}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{connection.name}</p>
                        <p className="text-xs text-[#8a8a8a]">{meta.label}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(connection)}
                      className="rounded-full p-1.5 text-[#8a8a8a] opacity-0 transition group-hover:opacity-100 hover:bg-[#241010] hover:text-[#ff8f8f]"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p className="mono truncate text-xs text-[#8a8a8a]">
                    {connection.type === "sqlite"
                      ? connection.filePath
                      : `${connection.user ?? ""}@${connection.host ?? "localhost"}:${
                          connection.port ?? meta.defaultPort
                        }/${connection.database ?? ""}`}
                  </p>

                  <button
                    disabled={!!isBusy}
                    onClick={() => (live ? openSession(live) : connect(connection))}
                    className={classNames(
                      "flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm transition",
                      live
                        ? "border-[#ff5a1f] bg-[#ff5a1f]/10 text-[#ff5a1f]"
                        : "border-[#262626]",
                      isBusy ? "opacity-60" : "hover:border-[#ff5a1f] hover:text-[#ff5a1f]",
                    )}
                  >
                    <Zap size={14} />
                    {isBusy
                      ? "Opening…"
                      : live
                        ? "Open workspace"
                        : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
