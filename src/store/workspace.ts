"use client";

import { create } from "zustand";
import type {
  ColumnInfo,
  LogEntry,
  LogLevel,
  QueryResult,
  SessionInfo,
  TableInfo,
} from "@/lib/types";

let logSeq = 0;
let queryController: AbortController | null = null;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface WorkspaceState {
  sessions: SessionInfo[];
  activeSid: string | null;
  session: SessionInfo | null;
  databases: string[];
  activeDatabase?: string;
  tables: TableInfo[];
  activeTable: string | null;
  activeSchema?: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  sort?: { column: string; dir: "asc" | "desc" };
  search: string;
  selectedRow: Record<string, unknown> | null;
  logs: LogEntry[];
  loadingTables: boolean;
  loadingRows: boolean;
  connecting: boolean;
  ready: boolean;
  error: string | null;
  queryResult: QueryResult | null;
  runningQuery: boolean;
  savingCell: { rowIndex: number; column: string } | null;

  addLog: (entry: { level: LogLevel; message: string; ms?: number; rows?: number }) => void;
  initSession: () => Promise<void>;
  createConnection: (body: { connectionId?: string; config?: unknown }) => Promise<boolean>;
  activateSession: (sid: string) => Promise<void>;
  closeConnection: (sid: string) => Promise<void>;
  setActiveDatabase: (database: string) => Promise<void>;
  loadTables: (database?: string) => Promise<void>;
  openTable: (table: string, schema?: string) => Promise<void>;
  loadRows: () => Promise<void>;
  refresh: () => Promise<void>;
  setPage: (page: number) => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
  setSearch: (term: string) => Promise<void>;
  toggleSort: (column: string) => Promise<void>;
  selectRow: (row: Record<string, unknown> | null) => void;
  updateCell: (rowIndex: number, column: string, value: unknown) => Promise<void>;
  clearLogs: () => void;
  runQuery: (sql: string) => Promise<void>;
  cancelQuery: () => void;
  disconnectAll: () => Promise<void>;
}

const blank = {
  tables: [] as TableInfo[],
  rows: [] as Record<string, unknown>[],
  columns: [] as ColumnInfo[],
  total: 0,
  activeTable: null,
  activeSchema: undefined,
  selectedRow: null,
  sort: undefined,
  page: 0,
  search: "",
  queryResult: null,
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  sessions: [],
  activeSid: null,
  session: null,
  databases: [],
  activeDatabase: undefined,
  tables: [],
  activeTable: null,
  activeSchema: undefined,
  columns: [],
  rows: [],
  total: 0,
  page: 0,
  pageSize: 100,
  sort: undefined,
  search: "",
  selectedRow: null,
  logs: [],
  loadingTables: false,
  loadingRows: false,
  connecting: false,
  ready: false,
  error: null,
  queryResult: null,
  runningQuery: false,
  savingCell: null,

  addLog: (entry) =>
    set((state) => ({
      logs: [{ id: `log-${++logSeq}`, at: Date.now(), ...entry }, ...state.logs].slice(0, 200),
    })),

  initSession: async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      const sessions: SessionInfo[] = data.sessions ?? [];
      const active = sessions.find((item) => item.sid === data.activeSid) ?? null;
      if (active) {
        set({
          sessions,
          activeSid: active.sid,
          session: active,
          databases: active.databases ?? [],
          activeDatabase: active.database ?? active.databases?.[0],
          ready: true,
        });
        await get().loadTables(active.database ?? active.databases?.[0]);
      } else {
        set({ sessions, activeSid: null, session: null, ready: true });
      }
    } catch (error) {
      set({ ready: true, error: message(error) });
    }
  },

  createConnection: async (body) => {
    set({ connecting: true, error: null });
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const active: SessionInfo = data.session;
      set({
        sessions: data.sessions ?? [],
        activeSid: data.activeSid,
        session: active,
        databases: active.databases ?? [],
        activeDatabase: active.database ?? active.databases?.[0],
        connecting: false,
        ready: true,
        ...blank,
      });
      get().addLog({ level: "info", message: `Connected to ${active.name} in ${data.ms}ms` });
      await get().loadTables(active.database ?? active.databases?.[0]);
      return true;
    } catch (error) {
      set({ connecting: false, error: message(error) });
      get().addLog({ level: "error", message: message(error) });
      return false;
    }
  },

  activateSession: async (sid) => {
    try {
      const res = await fetch("/api/sessions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const active: SessionInfo = data.session;
      set({
        activeSid: sid,
        session: active,
        databases: active.databases ?? [],
        activeDatabase: active.database ?? active.databases?.[0],
        ...blank,
      });
      get().addLog({ level: "info", message: `Switched to ${active.name}` });
      await get().loadTables(active.database ?? active.databases?.[0]);
    } catch (error) {
      set({ error: message(error) });
      get().addLog({ level: "error", message: message(error) });
    }
  },

  closeConnection: async (sid) => {
    try {
      const res = await fetch(`/api/sessions?sid=${encodeURIComponent(sid)}`, { method: "DELETE" });
      const data = await res.json();
      const remaining: SessionInfo[] = data.sessions ?? [];
      set({ sessions: remaining });
      if (sid === get().activeSid) {
        const next = remaining.find((item) => item.sid === data.activeSid) ?? null;
        if (next) {
          set({
            activeSid: next.sid,
            session: next,
            databases: next.databases ?? [],
            activeDatabase: next.database ?? next.databases?.[0],
            ...blank,
          });
          await get().loadTables(next.database ?? next.databases?.[0]);
        } else {
          set({ activeSid: null, session: null, databases: [], activeDatabase: undefined, ...blank });
        }
      }
    } catch (error) {
      set({ error: message(error) });
    }
  },

  setActiveDatabase: async (database) => {
    set({ activeDatabase: database, ...blank });
    await get().loadTables(database);
  },

  loadTables: async (database) => {
    const db = database ?? get().activeDatabase;
    if (!get().session) return;
    set({ loadingTables: true, error: null });
    try {
      const params = new URLSearchParams();
      if (db) params.set("database", db);
      const res = await fetch(`/api/tables?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ tables: data.tables, loadingTables: false });
    } catch (error) {
      set({ loadingTables: false, tables: [], error: message(error) });
      get().addLog({ level: "error", message: message(error) });
    }
  },

  openTable: async (table, schema) => {
    set({
      activeTable: table,
      activeSchema: schema,
      selectedRow: null,
      page: 0,
      sort: undefined,
      search: "",
    });
    await get().loadRows();
  },

  loadRows: async () => {
    const { activeTable, activeSchema, activeDatabase, page, pageSize, sort, search } = get();
    if (!activeTable) return;
    set({ loadingRows: true, error: null });
    try {
      const res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: activeDatabase,
          schema: activeSchema,
          table: activeTable,
          limit: pageSize,
          offset: page * pageSize,
          orderBy: sort?.column,
          orderDir: sort?.dir,
          search: search.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ columns: data.columns, rows: data.rows, total: data.total, loadingRows: false });
      get().addLog({
        level: "query",
        message: `${activeSchema ? `${activeSchema}.` : ""}${activeTable} · page ${page + 1}${
          search.trim() ? ` · filter "${search.trim()}"` : ""
        }`,
        ms: data.ms,
        rows: data.rows.length,
      });
    } catch (error) {
      set({ loadingRows: false, rows: [], columns: [], total: 0, error: message(error) });
      get().addLog({ level: "error", message: message(error) });
    }
  },

  refresh: async () => {
    await get().loadTables();
    if (get().activeTable) await get().loadRows();
  },

  setPage: async (page) => {
    set({ page: Math.max(0, page) });
    await get().loadRows();
  },

  setPageSize: async (size) => {
    set({ pageSize: size, page: 0 });
    await get().loadRows();
  },

  setSearch: async (term) => {
    if (term === get().search) return;
    set({ search: term, page: 0, selectedRow: null });
    await get().loadRows();
  },

  toggleSort: async (column) => {
    const current = get().sort;
    const dir = current?.column === column && current.dir === "asc" ? "desc" : "asc";
    set({ sort: { column, dir }, page: 0 });
    await get().loadRows();
  },

  selectRow: (row) => set({ selectedRow: row }),

  updateCell: async (rowIndex, column, value) => {
    const state = get();
    const row = state.rows[rowIndex];
    if (!row) return;
    const previous = row[column] ?? null;
    if (previous === value) return;

    const nextRow = { ...row, [column]: value };
    const nextRows = state.rows.map((current, index) => (index === rowIndex ? nextRow : current));
    const selectedRow = state.selectedRow === row ? nextRow : state.selectedRow;
    set({
      rows: nextRows,
      selectedRow,
      savingCell: { rowIndex, column },
      error: null,
    });

    try {
      const pkColumns = state.columns.filter((item) => item.isPrimaryKey).map((item) => item.name);
      const keyColumns = pkColumns.length
        ? pkColumns
        : state.columns.map((item) => item.name);
      const key: Record<string, unknown> = {};
      for (const name of keyColumns) key[name] = row[name] ?? null;

      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: state.activeDatabase,
          schema: state.activeSchema,
          table: state.activeTable,
          key,
          values: { [column]: value },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.updated !== 1) throw new Error(`Update affected ${data.updated} row(s)`);
      set({ savingCell: null });
      get().addLog({
        level: "query",
        message: `UPDATE ${state.activeTable} SET ${column} (${pkColumns.length ? "by pk" : "by full row"})`,
        ms: data.ms,
        rows: data.updated,
      });
    } catch (error) {
      set({
        rows: state.rows,
        selectedRow: state.selectedRow,
        savingCell: null,
        error: message(error),
      });
      get().addLog({ level: "error", message: message(error) });
      throw error;
    }
  },

  clearLogs: () => set({ logs: [] }),

  runQuery: async (sql) => {
    queryController?.abort();
    const controller = new AbortController();
    queryController = controller;
    set({ runningQuery: true, queryResult: null });
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, database: get().activeDatabase }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ queryResult: data, runningQuery: false });
      get().addLog({
        level: "query",
        message: sql.trim().split("\n")[0].slice(0, 80),
        ms: data.ms,
        rows: data.rowCount,
      });
    } catch (error) {
      set({ runningQuery: false });
      if (controller.signal.aborted) return;
      get().addLog({ level: "error", message: message(error) });
      throw error;
    } finally {
      if (queryController === controller) queryController = null;
    }
  },

  cancelQuery: () => {
    queryController?.abort();
    queryController = null;
    set({ runningQuery: false });
  },

  disconnectAll: async () => {
    await fetch("/api/sessions?all=1", { method: "DELETE" });
    set({
      sessions: [],
      activeSid: null,
      session: null,
      databases: [],
      activeDatabase: undefined,
      ...blank,
    });
  },
}));
