"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Database,
  FolderTree,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { classNames } from "@/lib/ui";

export function TablesPanel() {
  const tables = useWorkspace((state) => state.tables);
  const activeTable = useWorkspace((state) => state.activeTable);
  const activeSchema = useWorkspace((state) => state.activeSchema);
  const session = useWorkspace((state) => state.session);
  const databases = useWorkspace((state) => state.databases);
  const activeDatabase = useWorkspace((state) => state.activeDatabase);
  const loading = useWorkspace((state) => state.loadingTables);
  const openTable = useWorkspace((state) => state.openTable);
  const refresh = useWorkspace((state) => state.refresh);
  const setActiveDatabase = useWorkspace((state) => state.setActiveDatabase);
  const [filter, setFilter] = useState("");
  const [schemaFilter, setSchemaFilter] = useState("all");

  const schemaLabel = session?.type === "mysql" ? "Database" : "Schema";

  const schemas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const table of tables) counts.set(table.schema, (counts.get(table.schema) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tables]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return tables.filter((table) => {
      if (schemaFilter !== "all" && table.schema !== schemaFilter) return false;
      if (!needle) return true;
      return table.name.toLowerCase().includes(needle) || table.schema.toLowerCase().includes(needle);
    });
  }, [tables, filter, schemaFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const table of filtered) {
      const list = map.get(table.schema) ?? [];
      list.push(table);
      map.set(table.schema, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const showGroups = schemaFilter === "all" && schemas.length > 1;

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-2 border-b border-[#262626] px-3 py-2.5">
        <Table2 size={14} className="text-[#8a8a8a]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8a8a]">
          Tables
        </span>
        <span className="rounded-full bg-[#202020] px-2 py-0.5 text-[10px] text-[#8a8a8a]">
          {filtered.length}
        </span>
        <button
          onClick={refresh}
          className="ml-auto rounded-full p-1.5 text-[#8a8a8a] transition hover:bg-[#202020] hover:text-[#f5f5f5]"
          title="Refresh"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-b border-[#262626] p-2.5">
        {session && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#8a8a8a]">
            <Database size={11} className="shrink-0 text-[#ff5a1f]" />
            <span className="truncate font-medium text-[#d4d4d4]" title={session.name}>
              {session.name}
            </span>
            <span className="ml-auto shrink-0 rounded-full border border-[#262626] px-1.5 py-0.5">
              {session.type}
            </span>
          </div>
        )}

        {databases.length > 1 && (
          <div className="relative">
            <Database size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ff5a1f]" />
            <select
              value={activeDatabase ?? ""}
              onChange={(event) => setActiveDatabase(event.target.value)}
              className="w-full appearance-none rounded-full border border-[#262626] bg-[#0a0a0a] py-1.5 pl-7 pr-3 text-xs text-[#f5f5f5] outline-none transition focus:border-[#ff5a1f]"
              title="Select database"
            >
              {databases.map((database) => (
                <option key={database} value={database}>
                  {database}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8a8a]"
            />
          </div>
        )}

        {schemas.length > 1 && (
          <div className="relative">
            <Layers size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ff5a1f]" />
            <select
              value={schemaFilter}
              onChange={(event) => setSchemaFilter(event.target.value)}
              className="w-full appearance-none rounded-full border border-[#262626] bg-[#0a0a0a] py-1.5 pl-7 pr-3 text-xs text-[#f5f5f5] outline-none transition focus:border-[#ff5a1f]"
              title={`Filter by ${schemaLabel.toLowerCase()}`}
            >
              <option value="all">All {schemaLabel.toLowerCase()}s ({tables.length})</option>
              {schemas.map(([schema, count]) => (
                <option key={schema} value={schema}>
                  {schema} ({count})
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8a8a]"
            />
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8a8a]" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search tables…"
            className="w-full rounded-full border border-[#262626] bg-[#0a0a0a] py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#ff5a1f]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading && tables.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#8a8a8a]">Loading tables…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#8a8a8a]">No tables found</p>
        ) : (
          grouped.map(([schema, items]) => (
            <div key={schema} className="mb-0.5">
              {showGroups && (
                <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-[#191919] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
                  <FolderTree size={10} className="text-[#ff5a1f]" />
                  {schema}
                  <span className="ml-auto font-normal normal-case text-[#6b6b6b]">
                    {items.length}
                  </span>
                </div>
              )}
              {items.map((table) => {
                const active = activeTable === table.name && activeSchema === table.schema;
                return (
                  <button
                    key={`${table.schema}.${table.name}`}
                    onClick={() => openTable(table.name, table.schema)}
                    className={classNames(
                      "flex w-full items-center gap-2 py-1.5 pl-3 pr-3 text-left text-xs transition",
                      active
                        ? "border-l-2 border-[#ff5a1f] bg-[#ff5a1f]/10 pl-[10px] text-[#ff5a1f]"
                        : "border-l-2 border-transparent text-[#d4d4d4] hover:bg-[#202020]",
                    )}
                  >
                    <Table2 size={12} className="shrink-0 opacity-70" />
                    <span className="truncate">{table.name}</span>
                    {!showGroups && schemas.length > 1 && (
                      <span className="ml-auto shrink-0 rounded bg-[#202020] px-1.5 py-0.5 text-[9px] text-[#8a8a8a]">
                        {table.schema}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
