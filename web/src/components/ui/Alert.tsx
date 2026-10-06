import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type AlertTone = "error" | "warning" | "info" | "success";

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "border-danger-edge bg-danger-subtle text-danger",
  warning: "border-warning-edge bg-warning-subtle text-warning",
  info: "border-info-edge bg-info-subtle text-info",
  success: "border-success-edge bg-success-subtle text-success",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children, className, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border px-3 py-2.5 text-sm", TONE_CLASSES[tone], className)}
      {...props}
    >
      {children}
    </div>
  );
}
