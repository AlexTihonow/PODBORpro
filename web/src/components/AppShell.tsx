import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/cn";
import { navigate, usePathname } from "@/router";

import { Link } from "./Link";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";

const NAV_ITEMS = [
  { to: "/feed", label: "Лента" },
  { to: "/applications", label: "Отклики" },
  { to: "/onboarding", label: "Настройка" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, refreshMe, logout } = useAuth();
  const pathname = usePathname();

  // После перезагрузки токен есть, а данные профиля ещё нет — подтягиваем /me.
  useEffect(() => {
    if (!user) void refreshMe();
  }, [user, refreshMe]);

  return (
    <div>
      <header className="app-header">
        <div className="container app-header__inner">
          <div className="app-header__left">
            <Logo />
            <nav className="app-nav">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn("app-nav__link", pathname === item.to && "app-nav__link--active")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="app-header__right">
            {user && <span className="app-user">{user.full_name}</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="container app-main">{children}</main>
    </div>
  );
}
