"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import type { MessageType, RunMessage as RunMessageData } from "@/lib/sql-message";
import { classNames } from "@/lib/ui";

const STYLES: Record<MessageType, { box: string; Icon: typeof Info }> = {
  success: { box: "border-[#243024] bg-[#14241a] text-[#8ce99a]", Icon: CheckCircle2 },
  error: { box: "border-[#4a1f1f] bg-[#241010] text-[#ff8f8f]", Icon: XCircle },
  warning: { box: "border-[#3a2a14] bg-[#241a12] text-[#ff5a1f]", Icon: TriangleAlert },
  info: { box: "border-[#262626] bg-[#191919] text-[#d4d4d4]", Icon: Info },
};

export function RunMessage({
  message,
  onDismiss,
}: {
  message: RunMessageData;
  onDismiss: () => void;
}) {
  const { box, Icon } = STYLES[message.type];
  return (
    <div className={classNames("flex items-start gap-2.5 border-b px-3 py-2 text-xs", box)}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{message.title}</p>
        {message.detail && (
          <p className="mono mt-0.5 break-words text-[11px] leading-relaxed opacity-80">
            {message.detail}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}
