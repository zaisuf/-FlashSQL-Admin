"use client";

import { classNames } from "@/lib/ui";

export function Tooltip({
  label,
  side = "right",
  className,
  children,
}: {
  label: string;
  side?: "right" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={classNames("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={classNames(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-[#333333] bg-[#1c1c1c] px-2.5 py-1 text-[11px] text-[#f5f5f5] opacity-0 shadow-lg transition-opacity duration-100 group-hover/tt:opacity-100",
          side === "right"
            ? "left-full top-1/2 ml-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
