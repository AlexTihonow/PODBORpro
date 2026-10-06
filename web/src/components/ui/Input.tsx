import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500",
        invalid ? "border-danger focus:border-danger focus:ring-danger/30" : "border-edge",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
});
