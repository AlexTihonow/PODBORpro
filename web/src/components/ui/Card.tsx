import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div className={cn("card", className)} style={style}>
      {children}
    </div>
  );
}
