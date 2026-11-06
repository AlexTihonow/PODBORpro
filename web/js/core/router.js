const listeners = new Set();

function getBase() {
  const base = document.querySelector("base")?.getAttribute("href") ?? "/";
  try {
    const path = new URL(base, location.origin).pathname.replace(/\/+$/, "");
    return path === "" ? "" : path;
  } catch {
    return "";
  }
}

export function withBase(to) {
  if (/^(https?:|mailto:|tel:|#)/.test(to)) return to;
  return `${getBase()}${to.startsWith("/") ? to : `/${to}`}`;
}

export function getPathname() {
  const base = getBase();
  const { pathname } = location;
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || "/";
  }
  return pathname;
}

export function getNavState() {
  return history.state;
}

export function navigate(to, state) {
  history.pushState(state ?? null, "", withBase(to));
  emit();
}

export function replace(to, state) {
  history.replaceState(state ?? null, "", withBase(to));
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  if (event.shiftKey || event.altKey) return;

  const link = event.target.closest("a[data-link]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

  const to = link.getAttribute("data-to") ?? link.getAttribute("href");
  if (!to || /^(https?:|mailto:|tel:|#)/.test(to)) return;

  event.preventDefault();

  let state;
  const rawState = link.getAttribute("data-state");
  if (rawState) {
    try {
      state = JSON.parse(rawState);
    } catch {
      state = undefined;
    }
  }

  navigate(to, state);
});
