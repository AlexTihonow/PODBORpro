import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-subtle px-4 py-10">
      <Logo className="mb-6" />
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
