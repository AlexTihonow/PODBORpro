import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge--neutral",
  brand: "badge--brand",
  success: "badge--success",
  warning: "badge--warning",
  danger: "badge--danger",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return <span className={cn("badge", TONE_CLASS[tone], className)}>{children}</span>;
}
