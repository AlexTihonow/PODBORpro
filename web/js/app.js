import { renderApplicationsPage } from "./pages/applications/page.js";
import { renderLoginPage } from "./pages/auth/login.js";
import { renderRegisterPage } from "./pages/auth/register.js";
import { renderDevPage } from "./pages/dev/page.js";
import { renderFeedPage } from "./pages/feed/page.js";
import { renderLetterPage } from "./pages/letter/page.js";
import { renderNotFoundPage } from "./pages/not-found/page.js";
import { renderOnboardingPage } from "./pages/onboarding/page.js";
import { renderVacancyPage } from "./pages/vacancy/page.js";
import { getMe } from "./api/index.js";
import { getPathname, navigate, subscribe } from "./core/router.js";
import {
  getStoredUser,
  hasSession,
  onAccessTokenCleared,
  setProfile,
  setStoredUser,
} from "./core/session.js";

const PROTECTED_ROOTS = new Set(["feed", "vacancies", "onboarding", "letters", "applications"]);

let renderSequence = 0;

function normalize(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

async function route() {
  const renderId = ++renderSequence;
  const isCurrent = () => renderId === renderSequence;

  const path = normalize(getPathname());
  const segments = path.split("/").filter(Boolean);
  const from = `${path}${location.search}`;

  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  if (path === "/") {
    navigate("/feed");
    return;
  }

  if (path === "/login") {
    document.title = "Вход — ПОДБОРпро";
    if (hasSession()) {
      navigate("/feed");
      return;
    }
    renderLoginPage();
    return;
  }

  if (path === "/register") {
    document.title = "Регистрация — ПОДБОРпро";
    if (hasSession()) {
      navigate("/feed");
      return;
    }
    renderRegisterPage();
    return;
  }

  if (path === "/dev/components") {
    document.title = "Компоненты — ПОДБОРпро";
    renderDevPage();
    return;
  }

  if (PROTECTED_ROOTS.has(segments[0])) {
    if (!hasSession()) {
      navigate(`/login?from=${encodeURIComponent(from)}`);
      return;
    }

    if (segments[0] === "feed") {
      document.title = "Лента — ПОДБОРпро";
      void renderFeedPage(isCurrent);
      return;
    }

    if (segments[0] === "vacancies" && segments[1]) {
      document.title = "Вакансия — ПОДБОРпро";
      void renderVacancyPage(Number(segments[1]), isCurrent);
      return;
    }

    if (segments[0] === "onboarding") {
      document.title = "Настройка — ПОДБОРпро";
      renderOnboardingPage();
      return;
    }

    if (segments[0] === "letters" && segments[1]) {
      document.title = "Письмо — ПОДБОРпро";
      void renderLetterPage(Number(segments[1]), isCurrent);
      return;
    }

    if (segments[0] === "applications") {
      document.title = "Отклики — ПОДБОРпро";
      void renderApplicationsPage(isCurrent);
      return;
    }
  }

  document.title = "Не найдено — ПОДБОРпро";
  renderNotFoundPage();
}

subscribe(route);

// Never let the browser replace the SPA with a dropped file (e.g. its PDF viewer).
// Pages that accept files (onboarding) handle the drop themselves.
for (const type of ["dragover", "drop"]) {
  window.addEventListener(type, (event) => {
    if (event.dataTransfer?.types && Array.prototype.indexOf.call(event.dataTransfer.types, "Files") !== -1) {
      event.preventDefault();
    }
  });
}

onAccessTokenCleared(() => {
  const root = getPathname().split("/").filter(Boolean)[0];
  if (root && PROTECTED_ROOTS.has(root)) {
    navigate(`/login?from=${encodeURIComponent(`${getPathname()}${location.search}`)}`);
  }
});

async function boot() {
  if (hasSession() && !getStoredUser()) {
    try {
      const me = await getMe();
      setStoredUser({ id: me.id, email: me.email, full_name: me.full_name, is_admin: me.is_admin });
      setProfile(me.profile);
    } catch {}
  }
  route();
}

void boot();
