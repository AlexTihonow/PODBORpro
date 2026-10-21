import { navigate, withBase } from "./router.js";
import { getStoredUser, resetSession } from "./session.js";
import { esc, icon, initial, logo } from "./ui.js";

const NAV_ITEMS = [
  { id: "feed", to: "/feed", label: "Лента", icon: "feed" },
  { id: "applications", to: "/applications", label: "Отклики", icon: "board" },
  { id: "onboarding", to: "/onboarding", label: "Настройка", icon: "settings" },
];

export function mountShell(active, content) {
  const root = document.getElementById("root");
  const user = getStoredUser() ?? { full_name: "Профиль" };

  root.innerHTML = `
    <div class="app">
      <header class="app-header">
        <div class="container header-inner">
          <div class="header-left">
            ${logo()}
            <nav class="app-nav" aria-label="Разделы приложения">
              ${NAV_ITEMS.map(
                (item) => `<a class="app-nav__link${active === item.id ? " app-nav__link--active" : ""}" href="${withBase(item.to)}" data-link data-to="${item.to}">
                  ${icon(item.icon, "app-nav__icon")}<span>${item.label}</span>
                </a>`,
              ).join("")}
            </nav>
          </div>
          <div class="header-right">
            <div class="user-pill" title="${esc(user.full_name)}">
              <span class="avatar avatar--sm">${esc(initial(user.full_name))}</span>
              <span class="user-pill__name">${esc(user.full_name)}</span>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-logout>
              ${icon("logout")}<span class="btn__label">Выйти</span>
            </button>
          </div>
        </div>
      </header>
      <main class="container app-main" id="page">${content}</main>
    </div>
  `;

  root.querySelector("[data-logout]")?.addEventListener("click", () => {
    resetSession();
    navigate("/login");
  });

  return document.getElementById("page");
}

export function mountPublic(content) {
  const root = document.getElementById("root");
  root.innerHTML = content;
  return root;
}
