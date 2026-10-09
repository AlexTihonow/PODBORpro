import { useSyncExternalStore } from "react";

/**
 * Минимальный маршрутизатор на History API — без внешних библиотек.
 * navigate() меняет адрес, usePathname() перерисовывает компоненты при переходе.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

// Префикс, под которым опубликован клиент: "/" локально, "/PODBORpro/" на GitHub Pages.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Адрес внутри приложения ("/feed") -> настоящий адрес в браузере. */
export function withBase(to: string): string {
  return BASE + to;
}

export function navigate(to: string, state?: unknown): void {
  window.history.pushState(state ?? null, "", withBase(to));
  for (const listener of listeners) listener();
}

export function getPathname(): string {
  const { pathname } = window.location;
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || "/";
  return pathname;
}

/** Состояние, переданное в navigate(path, state) — например, выбранный элемент ленты. */
export function getNavState(): unknown {
  return window.history.state;
}

export function subscribeRouter(listener: Listener): () => void {
  listeners.add(listener);
  const onPopState = () => listener();
  window.addEventListener("popstate", onPopState);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPopState);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribeRouter, getPathname);
}
