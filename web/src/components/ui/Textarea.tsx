import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500",
        invalid ? "border-danger focus:border-danger focus:ring-danger/30" : "border-edge",
        "disabled:cursor-not-allowed disabled:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
});
