import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("field", className)}>
      <label htmlFor={htmlFor} className="field__label">
        {label}
        {required && <span className="field__required"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error">{error}</p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
