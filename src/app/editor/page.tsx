"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Columns3, Database, KeyRound, Loader2, Play, Square, Table2, X } from "lucide-react";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { SqlEditor } from "@/components/editor/SqlEditor";
import { RunMessage } from "@/components/editor/RunMessage";
import { useWorkspace } from "@/store/workspace";
import type { ColumnInfo, TableInfo } from "@/lib/types";
import { describeError, describeRun, type RunMessage as RunMessageData } from "@/lib/sql-message";
import { DB_META, classNames, formatValue } from "@/lib/ui";

export default function SqlEditorPage() {
  const router = useRouter();
  const ready = useWorkspace((state) => state.ready);
  const session = useWorkspace((state) => state.session);
  const sessions = useWorkspace((state) => state.sessions);
  const databases = useWorkspace((state) => state.databases);
  const activeDatabase = useWorkspace((state) => state.activeDatabase);
  const setActiveDatabase = useWorkspace((state) => state.setActiveDatabase);
  const activateSession = useWorkspace((state) => state.activateSession);
  const initSession = useWorkspace((state) => state.initSession);
  const runQuery = useWorkspace((state) => state.runQuery);
  const running = useWorkspace((state) => state.runningQuery);
  const cancelQuery = useWorkspace((state) => state.cancelQuery);
  const result = useWorkspace((state) => state.queryResult);

  const [sql, setSql] = useState("SELECT 1;");
  const [message, setMessage] = useState<RunMessageData | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

  useEffect(() => {
    if (!ready) initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(text: string) {
    if (!text.trim() || running) return;
    setSchemaOpen(false);
    setMessage(null);
    try {
      await runQuery(text);
      const data = useWorkspace.getState().queryResult;
      if (data) setMessage(describeRun(data));
    } catch (err) {
      setMessage(describeError(err));
    }
  }

  if (!ready) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#8a8a8a]">
          <Loader2 size={16} className="animate-spin" />
          Loading editor…
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Database size={30} className="text-[#8a8a8a]" />
          <div>
            <p className="display text-2xl text-[#f5f5f5]">No database connected</p>
            <p className="mt-1 text-xs text-[#8a8a8a]">
              Connect to a database before running SQL.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-full bg-[#ff5a1f] px-5 py-2 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c]"
          >
            Open connections
          </button>
        </div>
      </Shell>
    );
  }

  const meta = DB_META[session.type];

  return (
    <Shell>
      <header className="flex items-center gap-3 border-b border-[#262626] px-4 py-2.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.short}
        </div>

        {sessions.length > 1 ? (
          <select
            value={session.sid}
            onChange={(event) => {
              setSchemaOpen(false);
              activateSession(event.target.value);
            }}
            className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-xs outline-none focus:border-[#ff5a1f]"
          >
            {sessions.map((item) => (
              <option key={item.sid} value={item.sid}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium">{session.name}</span>
        )}

        {databases.length > 1 && (
          <select
            value={activeDatabase ?? ""}
            onChange={(event) => {
              setSchemaOpen(false);
              setActiveDatabase(event.target.value);
            }}
            className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-xs outline-none focus:border-[#ff5a1f]"
          >
            {databases.map((database) => (
              <option key={database} value={database}>
                {database}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => run(sql)}
            disabled={running}
            className="flex items-center gap-1.5 rounded-full bg-[#ff5a1f] px-4 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c] disabled:opacity-60"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? "Running…" : "Run"}
          </button>
          {running && (
            <button
              onClick={cancelQuery}
              className="flex items-center gap-1.5 rounded-full border border-[#3a3a3a] px-4 py-1.5 text-xs font-semibold text-[#ff8f8f] transition hover:border-[#ff5a1f] hover:text-[#f5f5f5]"
            >
              <Square size={12} />
              Cancel
            </button>
          )}
          <button
            onClick={() => setSchemaOpen((open) => !open)}
            className={classNames(
              "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs transition",
              schemaOpen
                ? "border-[#ff5a1f] bg-[#ff5a1f]/10 text-[#ff5a1f]"
                : "border-[#262626] text-[#d4d4d4] hover:border-[#3a3a3a] hover:text-[#f5f5f5]",
            )}
          >
            <Columns3 size={12} />
            View schema
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRun={run}
            onCancel={cancelQuery}
            placeholder="SELECT * FROM users LIMIT 10;"
          />

          <div className="flex items-center gap-3 border-b border-[#262626] bg-[#141414] px-3 py-1.5 text-[10px] text-[#8a8a8a]">
            <span>Select a statement (or nothing) then Ctrl/⌘ + Enter · Esc to cancel</span>
            {result && (
              <span className="text-[#8ce99a]">
                {(result.statementCount ?? 1) > 1
                  ? `${result.statementCount} statements · ${result.ms}ms`
                  : `${result.rowCount} row${result.rowCount === 1 ? "" : "s"} · ${result.ms}ms`}
              </span>
            )}
          </div>

          {message && <RunMessage message={message} onDismiss={() => setMessage(null)} />}

          {result?.statements && result.statements.length > 1 && (
            <ul className="max-h-32 shrink-0 overflow-auto border-b border-[#262626] bg-[#0f0f0f] py-1">
              {result.statements.map((statement, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 px-3 py-1 text-[10px] text-[#8a8a8a]"
                >
                  <span className="rounded bg-[#1e1e1e] px-1.5 py-0.5 text-[#d4d4d4]">
                    {index + 1}
                  </span>
                  <span className="mono truncate text-[#d4d4d4]">{statement.sql}</span>
                  <span className="ml-auto shrink-0">
                    {statement.rowCount} row{statement.rowCount === 1 ? "" : "s"} · {statement.ms}ms
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex-1 overflow-auto">
            {result && result.rows.length > 0 ? (
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#191919]">
                    {result.columns.map((column) => (
                      <th
                        key={column.name}
                        className="border-b border-r border-[#262626] px-3 py-2 text-left font-medium text-[#d4d4d4]"
                      >
                        <span>{column.name}</span>
                        <span className="mono ml-2 text-[10px] font-normal text-[#8a8a8a]">
                          {column.type}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 500).map((row, index) => (
                    <tr key={index} className={index % 2 ? "bg-[#0f0f0f]" : ""}>
                      {result.columns.map((column) => (
                        <td
                          key={column.name}
                          className="max-w-[320px] truncate border-b border-r border-[#1e1e1e] px-3 py-1.5 text-[#d4d4d4]"
                        >
                          {formatValue(row[column.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-4 text-xs text-[#8a8a8a]">
                {result
                  ? (result.statementCount ?? 1) > 1
                    ? `Ran ${result.statementCount} statements · ${result.ms}ms`
                    : "Query finished with no result rows"
                  : "Run a query to see results here"}
              </p>
            )}
          </div>
        </div>

        {schemaOpen && (
          <SchemaBrowser
            onInsert={(statement) => setSql(statement)}
            onClose={() => setSchemaOpen(false)}
          />
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen gap-2 overflow-hidden bg-[#0a0a0a] p-2">
      <ActivityBar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
        {children}
      </div>
    </div>
  );
}

function SchemaBrowser({
  onInsert,
  onClose,
}: {
  onInsert: (statement: string) => void;
  onClose: () => void;
}) {
  const activeDatabase = useWorkspace((state) => state.activeDatabase);
  const session = useWorkspace((state) => state.session);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selected, setSelected] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (activeDatabase) params.set("database", activeDatabase);
        const res = await fetch(`/api/tables?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setTables(data.tables ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeDatabase, session?.sid]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ table: selected!.name });
        if (activeDatabase) params.set("database", activeDatabase);
        if (selected!.schema) params.set("schema", selected!.schema);
        const res = await fetch(`/api/columns?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setColumns(data.columns ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selected, activeDatabase]);

  const grouped = useMemo(() => {
    const map = new Map<string, TableInfo[]>();
    for (const table of tables) {
      const key = table.schema || "default";
      const list = map.get(key) ?? [];
      list.push(table);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [tables]);

  const showSchemaHeaders = grouped.length > 1;

  return (
    <aside className="m-2 ml-0 flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#0f0f0f]">
      <div className="flex items-center gap-2 border-b border-[#262626] px-3 py-2">
        <Columns3 size={12} className="text-[#ff5a1f]" />
        <span className="text-xs font-medium">Schema</span>
        {loading && <Loader2 size={11} className="animate-spin text-[#8a8a8a]" />}
        <button
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-[#8a8a8a] transition hover:bg-[#202020] hover:text-[#f5f5f5]"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {error && (
        <div className="border-b border-[#4a1f1f] bg-[#241010] px-3 py-2 text-[11px] text-[#ff8f8f]">
          {error}
        </div>
      )}

      <div className="max-h-56 overflow-auto border-b border-[#262626] py-1">
        {grouped.length === 0 && !loading ? (
          <p className="px-3 py-2 text-[11px] text-[#8a8a8a]">No tables found</p>
        ) : (
          grouped.map(([schema, list]) => (
            <div key={schema}>
              {showSchemaHeaders && (
                <p className="sticky top-0 bg-[#141414] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]">
                  {schema}
                </p>
              )}
              {list.map((table) => {
                const isActive =
                  selected?.name === table.name && selected?.schema === table.schema;
                return (
                  <div
                    key={`${table.schema}.${table.name}`}
                    className={classNames(
                      "group flex items-center gap-2 px-3 py-1 text-[11px] transition",
                      isActive ? "bg-[#ff5a1f]/10 text-[#ff5a1f]" : "hover:bg-[#202020]",
                    )}
                  >
                    <button
                      onClick={() => {
                        setColumns([]);
                        setSelected(table);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Table2 size={11} className="shrink-0 text-[#8a8a8a]" />
                      <span className="truncate">{table.name}</span>
                    </button>
                    <button
                      onClick={() =>
                        onInsert(
                          `SELECT *\nFROM ${
                            table.schema && table.schema !== "default"
                              ? `${table.schema}.`
                              : ""
                          }${table.name}\nLIMIT 100;`,
                        )
                      }
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[#ff5a1f] opacity-0 transition group-hover:opacity-100 hover:bg-[#ff5a1f]/15"
                      title="Insert SELECT"
                    >
                      SELECT
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!selected ? (
          <p className="px-3 py-3 text-[11px] text-[#8a8a8a]">Pick a table to view its columns</p>
        ) : columns.length === 0 ? (
          <p className="px-3 py-3 text-[11px] text-[#8a8a8a]">Loading columns…</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {columns.map((column) => (
                <tr key={column.name}>
                  <td className="border-b border-[#1e1e1e] px-3 py-1 text-[#d4d4d4]">
                    <span className="flex items-center gap-1.5">
                      {column.isPrimaryKey && (
                        <KeyRound size={10} className="text-[#ff5a1f]" />
                      )}
                      <span className="truncate">{column.name}</span>
                    </span>
                  </td>
                  <td className="mono border-b border-[#1e1e1e] px-3 py-1 text-[#b9b9b9]">
                    {column.type}
                  </td>
                  <td className="border-b border-[#1e1e1e] px-3 py-1 text-[10px] text-[#8a8a8a]">
                    {column.nullable ? "NULL" : "NOT NULL"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </aside>
  );
}
