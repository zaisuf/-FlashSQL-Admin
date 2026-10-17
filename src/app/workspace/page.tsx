"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Database, Loader2 } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { TablesPanel } from "@/components/panels/TablesPanel";
import { DataPanel } from "@/components/panels/DataPanel";
import { RowInspector } from "@/components/panels/RowInspector";
import { classNames } from "@/lib/ui";

const resizeHandleClass =
  "bg-transparent transition hover:bg-[#ff5a1f]/50 data-[separator-state=drag]:bg-[#ff5a1f]";

function Handle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  return (
    <Separator
      className={classNames(
        resizeHandleClass,
        orientation === "horizontal" ? "w-2" : "h-2",
      )}
    />
  );
}

const panelClass = "overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen gap-2 overflow-hidden bg-[#0a0a0a] p-2">
      <ActivityBar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function WorkspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useWorkspace((state) => state.session);
  const ready = useWorkspace((state) => state.ready);
  const initSession = useWorkspace((state) => state.initSession);
  const createConnection = useWorkspace((state) => state.createConnection);

  useEffect(() => {
    const connectionId = params.get("connection");
    if (connectionId) createConnection({ connectionId });
    else initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && session && params.get("connection")) router.replace("/workspace");
  }, [ready, session, params, router]);

  if (!ready) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#262626] bg-[#141414] text-sm text-[#8a8a8a]">
          <Loader2 size={16} className="animate-spin" />
          Loading workspace…
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-[#262626] bg-[#141414] px-6 text-center">
          <Database size={30} className="text-[#8a8a8a]" />
          <div>
            <p className="display text-2xl text-[#f5f5f5]">No database connected</p>
            <p className="mt-1 text-xs text-[#8a8a8a]">
              Connect to one or more databases to start browsing their data.
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

  return (
    <Shell>
      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal" className="h-full">
          <Panel className={panelClass} defaultSize="22%" minSize="14%" maxSize="40%">
            <TablesPanel />
          </Panel>
          <Handle orientation="horizontal" />
          <Panel className={panelClass} defaultSize="50%" minSize="25%">
            <DataPanel />
          </Panel>
          <Handle orientation="horizontal" />
          <Panel className={panelClass} defaultSize="28%" minSize="15%" maxSize="45%">
            <RowInspector />
          </Panel>
        </Group>
      </div>
    </Shell>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center gap-2 text-sm text-[#8a8a8a]">
          <Loader2 size={16} className="animate-spin" />
          Loading workspace…
        </div>
      }
    >
      <WorkspaceInner />
    </Suspense>
  );
}
