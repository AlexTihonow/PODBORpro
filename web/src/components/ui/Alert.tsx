import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type AlertTone = "error" | "warning" | "info" | "success";

const TONE_CLASS: Record<AlertTone, string> = {
  error: "alert--error",
  warning: "alert--warning",
  info: "alert--info",
  success: "alert--success",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children, className, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn("alert", TONE_CLASS[tone], className)} {...props}>
      {children}
    </div>
  );
}
