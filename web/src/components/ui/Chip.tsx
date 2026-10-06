import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-edge bg-surface px-2 py-0.5 text-xs text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
