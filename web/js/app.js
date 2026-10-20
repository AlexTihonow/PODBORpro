import { renderApplicationsPage } from "./pages/applications.js";
import { renderLoginPage, renderRegisterPage } from "./pages/auth.js";
import { renderDevPage } from "./pages/dev.js";
import { renderFeedPage } from "./pages/feed.js";
import { renderLetterPage } from "./pages/letter.js";
import { renderNotFoundPage } from "./pages/notfound.js";
import { renderOnboardingPage } from "./pages/onboarding.js";
import { renderVacancyPage } from "./pages/vacancy.js";
import { getMe } from "./api.js";
import { getPathname, navigate, subscribe } from "./router.js";
import {
  getStoredUser,
  hasSession,
  onAccessTokenCleared,
  setProfile,
  setStoredUser,
} from "./session.js";

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
    document.title = "Вход — PODBORpro";
    if (hasSession()) {
      navigate("/feed");
      return;
    }
    renderLoginPage();
    return;
  }

  if (path === "/register") {
    document.title = "Регистрация — PODBORpro";
    if (hasSession()) {
      navigate("/feed");
      return;
    }
    renderRegisterPage();
    return;
  }

  if (path === "/dev/components") {
    document.title = "Компоненты — PODBORpro";
    renderDevPage();
    return;
  }

  if (PROTECTED_ROOTS.has(segments[0])) {
    if (!hasSession()) {
      navigate(`/login?from=${encodeURIComponent(from)}`);
      return;
    }

    if (segments[0] === "feed") {
      document.title = "Лента — PODBORpro";
      void renderFeedPage(isCurrent);
      return;
    }

    if (segments[0] === "vacancies" && segments[1]) {
      document.title = "Вакансия — PODBORpro";
      void renderVacancyPage(Number(segments[1]), isCurrent);
      return;
    }

    if (segments[0] === "onboarding") {
      document.title = "Настройка — PODBORpro";
      renderOnboardingPage();
      return;
    }

    if (segments[0] === "letters" && segments[1]) {
      document.title = "Письмо — PODBORpro";
      void renderLetterPage(Number(segments[1]), isCurrent);
      return;
    }

    if (segments[0] === "applications") {
      document.title = "Отклики — PODBORpro";
      void renderApplicationsPage(isCurrent);
      return;
    }
  }

  document.title = "Не найдено — PODBORpro";
  renderNotFoundPage();
}

subscribe(route);

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
    } catch {
      // Если токен устарел, api.js уже очистил его и маршрут уведёт на вход.
    }
  }
  route();
}

void boot();
