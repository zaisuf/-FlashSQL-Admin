"use client";

import { usePathname, useRouter } from "next/navigation";
import { Database, Home, ListTree, LogOut, Plus, SquareTerminal } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { classNames } from "@/lib/ui";
import { Tooltip } from "@/components/ui/Tooltip";

const ITEMS = [
  { href: "/workspace", icon: Database, label: "Database explorer" },
  { href: "/editor", icon: SquareTerminal, label: "SQL editor" },
  { href: "/logs", icon: ListTree, label: "Logs" },
] as const;

export function ActivityBar() {
  const router = useRouter();
  const pathname = usePathname();
  const logs = useWorkspace((state) => state.logs);
  const session = useWorkspace((state) => state.session);
  const disconnectAll = useWorkspace((state) => state.disconnectAll);

  const badgeFor = (href: string) => (href === "/logs" ? logs.length : 0);

  async function disconnect() {
    await disconnectAll();
    router.replace("/");
  }

  return (
    <div className="relative z-20 flex w-14 shrink-0 flex-col items-center rounded-2xl border border-[#262626] bg-[#141414] py-3">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = badgeFor(item.href);
        return (
          <Tooltip key={item.href} label={item.label} className="mb-1.5">
            <button
              onClick={() => router.push(item.href)}
              aria-label={item.label}
              className={classNames(
                "relative flex h-10 w-10 items-center justify-center rounded-xl transition",
                active
                  ? "bg-[#ff5a1f] text-[#0a0a0a]"
                  : "text-[#8a8a8a] hover:bg-[#202020] hover:text-[#f5f5f5]",
              )}
            >
              <Icon size={18} />
              {badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[9px] font-bold text-[#0a0a0a]">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <Tooltip label="New connection">
          <button
            onClick={() => router.push("/connect")}
            aria-label="New connection"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#262626] text-[#8a8a8a] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
          >
            <Plus size={18} />
          </button>
        </Tooltip>
        <Tooltip label="Home">
          <button
            onClick={() => router.push("/")}
            aria-label="Home"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8a8a8a] transition hover:bg-[#202020] hover:text-[#f5f5f5]"
          >
            <Home size={18} />
          </button>
        </Tooltip>
        {session && (
          <Tooltip label="Disconnect all">
            <button
              onClick={disconnect}
              aria-label="Disconnect all"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8a8a8a] transition hover:bg-[#241010] hover:text-[#ff8f8f]"
            >
              <LogOut size={18} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
