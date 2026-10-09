import { useSyncExternalStore } from "react";

/**
 * Минимальный маршрутизатор на History API — без внешних библиотек.
 * navigate() меняет адрес, usePathname() перерисовывает компоненты при переходе.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function navigate(to: string, state?: unknown): void {
  window.history.pushState(state ?? null, "", to);
  for (const listener of listeners) listener();
}

export function getPathname(): string {
  return window.location.pathname;
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
