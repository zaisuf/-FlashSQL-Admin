"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Columns3, Table2 } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { classNames } from "@/lib/ui";
import type { TableInfo } from "@/lib/types";

type Suggestion = { label: string; kind: "table" | "column"; detail?: string };

const TOKEN_RE = /([A-Za-z_][A-Za-z0-9_$]*)$/;
const REF_RE =
  /\b(?:from|join|update|into|table)\s+([A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*([A-Za-z_][A-Za-z0-9_$]*))?/gi;

function refKey(ref: { schema?: string; name: string }): string {
  return `${(ref.schema ?? "").toLowerCase()}.${ref.name.toLowerCase()}`;
}

function readToken(text: string): string {
  const match = TOKEN_RE.exec(text);
  return match ? match[1] : "";
}

function referencedTables(sql: string): { schema?: string; name: string }[] {
  const out: { schema?: string; name: string }[] = [];
  const seen = new Set<string>();
  REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_RE.exec(sql))) {
    const ref = match[2] ? { schema: match[1], name: match[2] } : { name: match[1] };
    const key = refKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: (sql: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const session = useWorkspace((state) => state.session);
  const activeDatabase = useWorkspace((state) => state.activeDatabase);
  const running = useWorkspace((state) => state.runningQuery);

  const ref = useRef<HTMLTextAreaElement>(null);
  const metrics = useRef({ charWidth: 7.2, lineHeight: 19.5, padTop: 16, padLeft: 16 });
  const requested = useRef<Set<string>>(new Set());

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [caret, setCaret] = useState({ start: 0, row: 0, col: 0, token: "" });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (activeDatabase) params.set("database", activeDatabase);
    fetch(`/api/tables?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTables(data.tables ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeDatabase, session?.sid]);

  useEffect(() => {
    requested.current = new Set();
    setColumns({});
  }, [activeDatabase, session?.sid]);

  const refs = useMemo(() => referencedTables(value), [value]);

  useEffect(() => {
    const missing = refs.filter((ref) => !requested.current.has(refKey(ref)));
    if (missing.length === 0) return;
    missing.forEach((ref) => requested.current.add(refKey(ref)));
    let cancelled = false;
    (async () => {
      const found: Record<string, string[]> = {};
      for (const ref of missing) {
        try {
          const params = new URLSearchParams({ table: ref.name });
          if (ref.schema) params.set("schema", ref.schema);
          if (activeDatabase) params.set("database", activeDatabase);
          const res = await fetch(`/api/columns?${params.toString()}`);
          const data = await res.json();
          if (res.ok) {
            found[refKey(ref)] = (data.columns ?? []).map((column: { name: string }) => column.name);
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled && Object.keys(found).length > 0) {
        setColumns((prev) => ({ ...prev, ...found }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refs, activeDatabase]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${styles.fontSize} ${styles.fontFamily}`;
      metrics.current.charWidth = ctx.measureText("00000000000000000000").width / 20;
    }
    metrics.current.lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.5;
    metrics.current.padTop = parseFloat(styles.paddingTop) || 0;
    metrics.current.padLeft = parseFloat(styles.paddingLeft) || 0;
  }, []);

  function syncCaret() {
    const el = ref.current;
    if (!el) return;
    const text = el.value;
    const start = el.selectionStart ?? 0;
    const before = text.slice(0, start);
    const lines = before.split("\n");
    const token = readToken(before);
    setCaret({ start, row: lines.length - 1, col: lines[lines.length - 1].length, token });
    setIndex(0);
    setOpen(token.length >= 1);
    setScroll({ top: el.scrollTop, left: el.scrollLeft });
  }

  const suggestions = useMemo<Suggestion[]>(() => {
    const token = caret.token.toLowerCase();
    if (!token) return [];
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    for (const table of tables) {
      if (table.name.toLowerCase().startsWith(token) && !seen.has(table.name)) {
        seen.add(table.name);
        out.push({ label: table.name, kind: "table", detail: table.schema });
      }
    }
    for (const [key, cols] of Object.entries(columns)) {
      for (const column of cols) {
        if (column.toLowerCase().startsWith(token) && !seen.has(column)) {
          seen.add(column);
          out.push({ label: column, kind: "column", detail: key.split(".").pop() });
        }
      }
    }
    return out.slice(0, 12);
  }, [caret.token, tables, columns]);

  function accept(suggestion: Suggestion) {
    const el = ref.current;
    if (!el) return;
    const text = el.value;
    const end = el.selectionStart ?? caret.start;
    const before = text.slice(0, caret.start - caret.token.length);
    const after = text.slice(end);
    onChange(before + suggestion.label + after);
    const pos = before.length + suggestion.label.length;
    setOpen(false);
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(pos, pos);
    });
  }

  function runSelection() {
    const el = ref.current;
    const selection =
      el && el.selectionStart !== el.selectionEnd
        ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
        : value;
    setOpen(false);
    onRun(selection);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      runSelection();
      return;
    }
    if (event.key === "Escape") {
      if (open && suggestions.length > 0) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (running) {
        event.preventDefault();
        onCancel();
      }
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      accept(suggestions[index]);
    }
  }

  const show = open && suggestions.length > 0;
  const top = metrics.current.padTop + (caret.row + 1) * metrics.current.lineHeight - scroll.top;
  const left = metrics.current.padLeft + caret.col * metrics.current.charWidth - scroll.left;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          syncCaret();
        }}
        onKeyDown={handleKeyDown}
        onClick={syncCaret}
        onKeyUp={(event) => {
          if (
            event.key.length === 1 ||
            event.key === "Backspace" ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "Home" ||
            event.key === "End"
          ) {
            syncCaret();
          }
        }}
        onScroll={(event) => {
          const el = event.target as HTMLTextAreaElement;
          setScroll({ top: el.scrollTop, left: el.scrollLeft });
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        spellCheck={false}
        placeholder={placeholder}
        className="mono h-80 min-h-40 w-full resize-y border-b border-[#262626] bg-[#0a0a0a] p-4 text-xs leading-relaxed text-[#f5f5f5] outline-none"
      />

      {show && (
        <ul
          style={{ top, left }}
          className="absolute z-30 max-h-56 w-64 overflow-auto rounded-xl border border-[#262626] bg-[#191919] py-1 shadow-2xl"
        >
          {suggestions.map((suggestion, i) => (
            <li key={`${suggestion.kind}-${suggestion.label}`}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(suggestion);
                }}
                onMouseEnter={() => setIndex(i)}
                className={classNames(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                  i === index ? "bg-[#ff5a1f]/15 text-[#ff5a1f]" : "text-[#d4d4d4]",
                )}
              >
                {suggestion.kind === "table" ? (
                  <Table2 size={11} className="shrink-0 text-[#8a8a8a]" />
                ) : (
                  <Columns3 size={11} className="shrink-0 text-[#8a8a8a]" />
                )}
                <span className="mono truncate">{suggestion.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[#6b6b6b]">
                  {suggestion.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
