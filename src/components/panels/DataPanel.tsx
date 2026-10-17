"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  Search,
  Table2,
  Wand2,
  X,
} from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { classNames, coerceValue, formatNumber, formatValue } from "@/lib/ui";

type Status = { kind: "saving" | "saved" | "error"; text: string };

export function DataPanel() {
  const activeTable = useWorkspace((state) => state.activeTable);
  const columns = useWorkspace((state) => state.columns);
  const rows = useWorkspace((state) => state.rows);
  const total = useWorkspace((state) => state.total);
  const page = useWorkspace((state) => state.page);
  const pageSize = useWorkspace((state) => state.pageSize);
  const sort = useWorkspace((state) => state.sort);
  const search = useWorkspace((state) => state.search);
  const loading = useWorkspace((state) => state.loadingRows);
  const selectedRow = useWorkspace((state) => state.selectedRow);
  const selectRow = useWorkspace((state) => state.selectRow);
  const toggleSort = useWorkspace((state) => state.toggleSort);
  const setPage = useWorkspace((state) => state.setPage);
  const setPageSize = useWorkspace((state) => state.setPageSize);
  const setSearch = useWorkspace((state) => state.setSearch);
  const savingCell = useWorkspace((state) => state.savingCell);
  const updateCell = useWorkspace((state) => state.updateCell);

  const [term, setTerm] = useState(search);
  const [editing, setEditing] = useState<{ rowIndex: number; column: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (term === search) return;
    const timer = setTimeout(() => {
      void setSearch(term);
    }, 300);
    return () => clearTimeout(timer);
  }, [term, search, setSearch]);

  useEffect(() => {
    setTerm("");
  }, [activeTable]);

  if (!activeTable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Wand2 size={26} className="text-[#8a8a8a]" />
        <p className="text-sm text-[#8a8a8a]">Select a table from the left panel to preview data</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  function beginEdit(rowIndex: number, column: string, value: unknown) {
    setEditing({ rowIndex, column });
    setDraft(value === null || value === undefined ? "" : String(value));
    setStatus(null);
  }

  async function commitEdit() {
    if (!editing) return;
    const { rowIndex, column } = editing;
    const original = rows[rowIndex]?.[column] ?? null;
    const value = coerceValue(original, draft);
    setEditing(null);
    if (value === original) return;

    setStatus({ kind: "saving", text: `Updating ${column}…` });
    try {
      await updateCell(rowIndex, column, value);
      setStatus({ kind: "saved", text: `${column} updated` });
      setTimeout(() => setStatus((current) => (current?.kind === "saved" ? null : current)), 2500);
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-2 border-b border-[#262626] px-4 py-3">
        <Table2 size={14} className="text-[#ff5a1f]" />
        <span className="text-xs font-semibold">{activeTable}</span>
        <span className="rounded-full bg-[#202020] px-2 py-0.5 text-[10px] text-[#8a8a8a]">
          {formatNumber(total)} rows
        </span>
        {loading && <Loader2 size={13} className="animate-spin text-[#8a8a8a]" />}

        <div className="relative ml-auto w-56">
          <Search
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]"
          />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search all columns…"
            className="w-full rounded-full border border-[#262626] bg-[#0a0a0a] py-1.5 pl-8 pr-7 text-xs text-[#f5f5f5] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff5a1f]"
          />
          {term && (
            <button
              onClick={() => {
                setTerm("");
                void setSearch("");
              }}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#6b6b6b] transition hover:text-[#f5f5f5]"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a8a]">
          <Pencil size={10} />
          Double-click a cell to edit
        </span>

        {editing && (
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={commitEdit}
            className="flex items-center gap-1.5 rounded-full bg-[#ff5a1f] px-3 py-1 text-[10px] font-semibold text-[#0a0a0a] transition hover:bg-[#ff6f3c]"
          >
            <Save size={11} />
            Save
          </button>
        )}

        {status && (
          <span
            className={classNames(
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px]",
              status.kind === "saved"
                ? "bg-[#14241a] text-[#8ce99a]"
                : status.kind === "error"
                  ? "max-w-[280px] truncate bg-[#241010] text-[#ff8f8f]"
                  : "bg-[#241a12] text-[#b9b9b9]",
            )}
            title={status.text}
          >
            {status.kind === "saving" && <Loader2 size={9} className="animate-spin" />}
            {status.text}
          </span>
        )}
      </div>

      <div className="relative flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#191919]">
              <th className="w-10 border-b border-r border-[#262626] px-2 py-2 text-left font-medium text-[#8a8a8a]">
                #
              </th>
              {columns.map((column) => {
                const isSorted = sort?.column === column.name;
                return (
                  <th
                    key={column.name}
                    onClick={() => toggleSort(column.name)}
                    className="cursor-pointer select-none border-b border-r border-[#262626] px-3 py-2 text-left align-top font-medium text-[#d4d4d4] transition hover:bg-[#202020]"
                  >
                    <div className="flex items-center gap-1.5">
                      {column.isPrimaryKey && <KeyRound size={10} className="text-[#ff5a1f]" />}
                      <span>{column.name}</span>
                      {isSorted && (
                        <span className="text-[#ff5a1f]">{sort?.dir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                    <span className="mono text-[10px] font-normal text-[#8a8a8a]">{column.type}</span>
                  </th>
                );
              })}
              {columns.length === 0 && (
                <th className="border-b border-[#262626] px-3 py-2 text-left text-[#8a8a8a]">
                  (no columns)
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const selected = selectedRow === row;
              return (
                <tr
                  key={index}
                  onClick={() => selectRow(row)}
                  className={classNames(
                    "transition",
                    selected ? "bg-[#ff5a1f]/10" : index % 2 ? "bg-[#0f0f0f]" : "bg-transparent",
                    "hover:bg-[#202020]",
                  )}
                >
                  <td className="border-b border-r border-[#1e1e1e] px-2 py-1.5 text-right text-[#8a8a8a]">
                    {page * pageSize + index + 1}
                  </td>
                  {columns.map((column) => {
                    const isEditing =
                      editing?.rowIndex === index && editing.column === column.name;
                    const isSaving =
                      savingCell?.rowIndex === index && savingCell.column === column.name;
                    const value = row[column.name];

                    if (isEditing) {
                      return (
                        <td
                          key={column.name}
                          className="border-b border-r border-[#1e1e1e] p-0 align-middle"
                        >
                          <input
                            autoFocus
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitEdit();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditing(null);
                              }
                            }}
                            className="mono w-full min-w-[120px] bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#f5f5f5] outline-none ring-2 ring-inset ring-[#ff5a1f]"
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={column.name}
                        onDoubleClick={() => beginEdit(index, column.name, value)}
                        title="Double-click to edit"
                        className={classNames(
                          "max-w-[320px] cursor-text truncate border-b border-r border-[#1e1e1e] px-3 py-1.5",
                          typeof value === "number" ? "text-right" : "",
                          value === null ? "italic text-[#8a8a8a]" : "text-[#d4d4d4]",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{formatValue(value)}</span>
                          {isSaving && (
                            <Loader2 size={10} className="shrink-0 animate-spin text-[#b9b9b9]" />
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-[#8a8a8a]">
                  {search.trim() ? `No rows match “${search.trim()}”` : "No rows"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 border-t border-[#262626] px-4 py-2.5 text-xs text-[#8a8a8a]">
        <span>
          {from}–{to} of {formatNumber(total)}
        </span>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          title="Rows per page"
          className="rounded-full border border-[#262626] bg-[#0a0a0a] px-3 py-1 text-xs outline-none"
        >
          {[50, 100, 250, 500, 1000].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0 || loading}
            title="Previous page"
            className="rounded-full border border-[#262626] p-1.5 transition hover:border-[#3a3a3a] disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page + 1 >= totalPages || loading}
            title="Next page"
            className="rounded-full border border-[#262626] p-1.5 transition hover:border-[#3a3a3a] disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
