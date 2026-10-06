import type { AnchorHTMLAttributes, ReactNode } from "react";

import { navigate } from "@/router";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  state?: unknown;
  children: ReactNode;
}

/** Ссылка, которая переходит без перезагрузки страницы (через мини-роутер). */
export function Link({ to, state, children, ...props }: LinkProps) {
  return (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        navigate(to, state);
      }}
    >
      {children}
    </a>
  );
}
