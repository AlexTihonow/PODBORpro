import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500",
        invalid ? "border-danger" : "border-edge",
        "disabled:cursor-not-allowed disabled:bg-surface-muted",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
