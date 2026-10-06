import { useEffect } from "react";
import type { ReactNode } from "react";

import { navigate, usePathname } from "@/router";

import { useAuth } from "./AuthContext";

/**
 * Закрытые страницы: без токена перенаправляют на /login,
 * запоминая, откуда пришёл человек, чтобы вернуть его после входа.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!token) {
      navigate(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [token, pathname]);

  if (!token) return null;

  return <>{children}</>;
}
