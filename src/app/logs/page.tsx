"use client";

import { useEffect, useMemo, useState } from "react";
import { ListTree, Trash2 } from "lucide-react";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { useWorkspace } from "@/store/workspace";
import type { LogLevel } from "@/lib/types";
import { classNames } from "@/lib/ui";

type Filter = "all" | LogLevel;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "query", label: "Queries" },
  { id: "info", label: "Info" },
  { id: "error", label: "Errors" },
];

export default function LogsPage() {
  const logs = useWorkspace((state) => state.logs);
  const clearLogs = useWorkspace((state) => state.clearLogs);
  const ready = useWorkspace((state) => state.ready);
  const initSession = useWorkspace((state) => state.initSession);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!ready) initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((log) => log.level === filter)),
    [logs, filter],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: logs.length };
    for (const log of logs) result[log.level] = (result[log.level] ?? 0) + 1;
    return result;
  }, [logs]);

  return (
    <div className="flex h-screen gap-2 overflow-hidden bg-[#0a0a0a] p-2">
      <ActivityBar />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
        <header className="flex items-center gap-3 border-b border-[#262626] px-5 py-3">
          <ListTree size={16} className="text-[#ff5a1f]" />
          <h1 className="text-sm font-semibold">Logs</h1>
          <span className="rounded-full border border-[#262626] px-2.5 py-0.5 text-[10px] text-[#8a8a8a]">
            {logs.length} entries
          </span>

          <div className="ml-4 flex items-center gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={classNames(
                  "rounded-full px-3 py-1 text-xs transition",
                  filter === item.id
                    ? "bg-[#ff5a1f]/10 text-[#ff5a1f]"
                    : "text-[#8a8a8a] hover:bg-[#202020] hover:text-[#f5f5f5]",
                )}
              >
                {item.label}
                <span className="ml-1.5 text-[10px] opacity-70">{counts[item.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-[#262626] px-3.5 py-1.5 text-xs text-[#d4d4d4] transition hover:border-[#4a1f1f] hover:text-[#ff8f8f] disabled:opacity-40"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </header>

        <div className="mono flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-xs text-[#8a8a8a]">
              {logs.length === 0 ? "No activity yet." : "No entries for this filter."}
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#191919] text-left text-[#8a8a8a]">
                  <th className="w-28 border-b border-r border-[#262626] px-3 py-2 font-medium">
                    Time
                  </th>
                  <th className="w-20 border-b border-r border-[#262626] px-3 py-2 font-medium">
                    Level
                  </th>
                  <th className="border-b border-r border-[#262626] px-3 py-2 font-medium">
                    Message
                  </th>
                  <th className="w-20 border-b border-r border-[#262626] px-3 py-2 text-right font-medium">
                    Time
                  </th>
                  <th className="w-24 border-b border-[#262626] px-3 py-2 text-right font-medium">
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, index) => (
                  <tr key={log.id} className={index % 2 ? "bg-[#0f0f0f]" : ""}>
                    <td className="border-b border-r border-[#1e1e1e] px-3 py-1.5 text-[#8a8a8a]">
                      {new Date(log.at).toLocaleTimeString("en-US", { hour12: false })}
                    </td>
                    <td className="border-b border-r border-[#1e1e1e] px-3 py-1.5">
                      <span
                        className={classNames(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          log.level === "error"
                            ? "bg-[#241010] text-[#ff8f8f]"
                            : log.level === "query"
                              ? "bg-[#241a12] text-[#b9b9b9]"
                              : "bg-[#14241a] text-[#8ce99a]",
                        )}
                      >
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="border-b border-r border-[#1e1e1e] px-3 py-1.5 text-[#d4d4d4]">
                      {log.message}
                    </td>
                    <td className="border-b border-r border-[#1e1e1e] px-3 py-1.5 text-right text-[#8a8a8a]">
                      {log.ms !== undefined ? `${log.ms}ms` : "—"}
                    </td>
                    <td className="border-b border-[#1e1e1e] px-3 py-1.5 text-right text-[#8a8a8a]">
                      {log.rows !== undefined ? log.rows : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
