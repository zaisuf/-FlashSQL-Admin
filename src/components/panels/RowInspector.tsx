"use client";

import { useState } from "react";
import { Braces, Check, Columns3, Copy, KeyRound } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { classNames } from "@/lib/ui";

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = { paddingLeft: `${depth * 14}px` };

  if (value === null) return <span className="text-[#8a8a8a] italic">null</span>;
  if (value === undefined) return <span className="text-[#8a8a8a] italic">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-[#c9c9c9]">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-[#b9b9b9]">{value}</span>;
  if (typeof value === "string")
    return <span className="break-all text-[#d4d4d4]">&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[#8a8a8a]">[]</span>;
    return (
      <div>
        <span className="text-[#8a8a8a]">[</span>
        {value.map((item, index) => (
          <div key={index} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
            <JsonTree value={item} depth={0} />
            {index < value.length - 1 && <span className="text-[#8a8a8a]">,</span>}
          </div>
        ))}
        <div style={indent}>
          <span className="text-[#8a8a8a]">]</span>
        </div>
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-[#8a8a8a]">{"{}"}</span>;
  return (
    <div>
      <span className="text-[#8a8a8a]">{"{"}</span>
      {entries.map(([key, item], index) => (
        <div key={key} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
          <span className="text-[#8ce99a]">&quot;{key}&quot;</span>
          <span className="text-[#8a8a8a]">: </span>
          <JsonTree value={item} depth={0} />
          {index < entries.length - 1 && <span className="text-[#8a8a8a]">,</span>}
        </div>
      ))}
      <div style={indent}>
        <span className="text-[#8a8a8a]">{"}"}</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition",
        active
          ? "bg-[#ff5a1f]/10 text-[#ff5a1f]"
          : "text-[#8a8a8a] hover:bg-[#202020] hover:text-[#f5f5f5]",
      )}
    >
      {children}
    </button>
  );
}

function SchemaView() {
  const columns = useWorkspace((state) => state.columns);
  const activeTable = useWorkspace((state) => state.activeTable);

  if (!activeTable) {
    return (
      <p className="px-4 py-4 text-[11px] text-[#8a8a8a]">Select a table to see its schema</p>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {["Column", "Type", "Nullable", "Default", "Key"].map((heading) => (
              <th
                key={heading}
                className="sticky top-0 border-b border-r border-[#262626] bg-[#191919] px-3 py-2 text-left font-medium text-[#8a8a8a]"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.name}>
              <td className="border-b border-r border-[#1e1e1e] px-3 py-1 text-[#d4d4d4]">
                {column.name}
              </td>
              <td className="mono border-b border-r border-[#1e1e1e] px-3 py-1 text-[#b9b9b9]">
                {column.type}
              </td>
              <td className="border-b border-r border-[#1e1e1e] px-3 py-1 text-[#d4d4d4]">
                {column.nullable ? "YES" : "NO"}
              </td>
              <td className="border-b border-r border-[#1e1e1e] px-3 py-1 text-[#8a8a8a]">
                {column.defaultValue ?? "—"}
              </td>
              <td className="border-b border-r border-[#1e1e1e] px-3 py-1">
                {column.isPrimaryKey && <KeyRound size={11} className="text-[#ff5a1f]" />}
              </td>
            </tr>
          ))}
          {columns.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-[#8a8a8a]">
                No columns
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function RowInspector() {
  const selectedRow = useWorkspace((state) => state.selectedRow);
  const activeTable = useWorkspace((state) => state.activeTable);
  const [tab, setTab] = useState<"json" | "schema">("json");
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!selectedRow) return;
    await navigator.clipboard.writeText(JSON.stringify(selectedRow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-1 border-b border-[#262626] px-2 py-2">
        <TabButton active={tab === "json"} onClick={() => setTab("json")}>
          <Braces size={12} />
          JSON
        </TabButton>
        <TabButton active={tab === "schema"} onClick={() => setTab("schema")}>
          <Columns3 size={12} />
          Schema
        </TabButton>

        {tab === "json" && selectedRow && (
          <button
            onClick={copy}
            className="ml-auto flex items-center gap-1 rounded-full border border-[#262626] px-2.5 py-1 text-[10px] text-[#d4d4d4] transition hover:border-[#3a3a3a]"
          >
            {copied ? <Check size={11} className="text-[#ff5a1f]" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        {tab === "schema" && activeTable && (
          <span className="ml-auto rounded-full bg-[#202020] px-2 py-0.5 text-[10px] text-[#8a8a8a]">
            {activeTable}
          </span>
        )}
      </div>

      {tab === "json" ? (
        selectedRow ? (
          <div className="flex-1 overflow-auto p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[#8a8a8a]">
              {activeTable}
            </p>
            <pre className="mono whitespace-pre-wrap break-all text-[11px] leading-relaxed">
              <JsonTree value={selectedRow} />
            </pre>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-xs text-[#8a8a8a]">
              Click any row in the center panel to inspect it as JSON
            </p>
          </div>
        )
      ) : (
        <div className="flex-1 overflow-hidden">
          <SchemaView />
        </div>
      )}
    </div>
  );
}
