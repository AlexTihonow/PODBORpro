import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/useAuthStore";
import { cn } from "@/lib/cn";

import { Logo } from "./Logo";
import { Button } from "./ui/Button";

const NAV_ITEMS = [
  { to: "/feed", label: "Лента" },
  { to: "/applications", label: "Отклики" },
  { to: "/onboarding", label: "Настройка" },
];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // После перезагрузки токен есть, а данные профиля ещё нет — подтягиваем /me.
  useEffect(() => {
    if (!user) void refreshMe();
  }, [user, refreshMe]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface">
        <div className="mx-auto flex h-14 max-w-screen items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-ink-muted">{user.full_name}</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
