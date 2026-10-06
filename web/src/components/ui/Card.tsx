import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-edge bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}
