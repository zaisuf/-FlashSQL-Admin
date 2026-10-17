"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Plug, X } from "lucide-react";
import type { ConnConfig, DbType } from "@/lib/types";
import { DB_META, DB_TYPES, classNames } from "@/lib/ui";
import { DbLogo } from "@/components/ui/DbLogo";

const emptyConfig: ConnConfig = {
  type: "postgres",
  name: "",
  host: "localhost",
  port: 5432,
  user: "",
  password: "",
  database: "",
  ssl: false,
  filePath: "",
};

export default function ConnectPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConnConfig>(emptyConfig);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ConnConfig>(key: K, value: ConnConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  }

  function selectType(type: DbType) {
    setConfig((prev) => ({ ...prev, type, port: DB_META[type].defaultPort || undefined }));
    setTestResult(null);
    setError(null);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestResult({ ok: true, text: `Connected in ${data.ms}ms` });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConnecting(false);
    }
  }

  const isSqlite = config.type === "sqlite";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <button
        onClick={() => router.push("/")}
        className="flex w-fit items-center gap-2 text-sm text-[#8a8a8a] transition hover:text-[#f5f5f5]"
      >
        <ArrowLeft size={16} />
        Connections
      </button>

      <div className="rounded-3xl border border-[#262626] bg-[#141414] p-6">
        <h1 className="display text-2xl text-[#f5f5f5]">New connection</h1>
        <p className="mt-1 text-xs text-[#8a8a8a]">
          Connect to PostgreSQL, MySQL / MariaDB, SQL Server or SQLite. Connections are saved
          automatically so you can reopen them with one click.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DB_TYPES.map((type) => {
            const meta = DB_META[type];
            const active = config.type === type;
            return (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={classNames(
                  "flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs transition",
                  active
                    ? "border-[#ff5a1f] bg-[#ff5a1f]/10 text-[#ff5a1f]"
                    : "border-[#262626] text-[#8a8a8a] hover:border-[#3a3a3a] hover:text-[#f5f5f5]",
                )}
              >
                <span
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    active ? "bg-white/10" : "bg-white/5 grayscale",
                  )}
                >
                  <DbLogo type={type} size={22} />
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Connection name">
            <input
              value={config.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={`My ${DB_META[config.type].label}`}
              className={inputClass}
            />
          </Field>

          {isSqlite ? (
            <Field label="Database file path">
              <input
                value={config.filePath}
                onChange={(event) => update("filePath", event.target.value)}
                placeholder="C:\\data\\app.db"
                className={inputClass}
              />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Host">
                    <input
                      value={config.host}
                      onChange={(event) => update("host", event.target.value)}
                      placeholder="localhost"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Port">
                  <input
                    type="number"
                    value={config.port ?? ""}
                    onChange={(event) => update("port", Number(event.target.value) || undefined)}
                    placeholder={String(DB_META[config.type].defaultPort)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="User">
                  <input
                    value={config.user}
                    onChange={(event) => update("user", event.target.value)}
                    placeholder="postgres"
                    className={inputClass}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    value={config.password}
                    onChange={(event) => update("password", event.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Database">
                <input
                  value={config.database}
                  onChange={(event) => update("database", event.target.value)}
                  placeholder="postgres"
                  className={inputClass}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-[#8a8a8a]">
                <input
                  type="checkbox"
                  checked={!!config.ssl}
                  onChange={(event) => update("ssl", event.target.checked)}
                  className="h-4 w-4 accent-[#ff5a1f]"
                />
                Use SSL
              </label>
            </>
          )}
        </div>

        {testResult && (
          <div
            className={classNames(
              "mt-5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              testResult.ok
                ? "border-[#243024] bg-[#14241a] text-[#8ce99a]"
                : "border-[#4a1f1f] bg-[#241010] text-[#ff8f8f]",
            )}
          >
            {testResult.ok ? <Check size={15} /> : <X size={15} />}
            {testResult.text}
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#4a1f1f] bg-[#241010] px-3 py-2 text-sm text-[#ff8f8f]">
            <X size={15} />
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={connect}
            disabled={connecting}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff5a1f] py-2.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c] disabled:opacity-60"
          >
            {connecting ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
            {connecting ? "Connecting…" : "Connect"}
          </button>
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex items-center justify-center gap-2 rounded-full border border-[#262626] px-6 py-2.5 text-sm text-[#d4d4d4] transition hover:border-[#3a3a3a] hover:text-[#f5f5f5] disabled:opacity-60"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : null}
            Test connection
          </button>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#262626] bg-[#0a0a0a] px-4 py-2.5 text-sm outline-none transition focus:border-[#ff5a1f]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#8a8a8a]">{label}</span>
      {children}
    </label>
  );
}
