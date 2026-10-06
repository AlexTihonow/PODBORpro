import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "./useAuthStore";

/**
 * Закрытые страницы: без токена перенаправляют на /login,
 * запоминая, откуда пришёл человек, чтобы вернуть его после входа.
 */
export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
