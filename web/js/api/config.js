export const CONFIG = {
  apiBase: "/api/v1",
  useStubs: null,
  stubDelay: 420,
  ...(window.PODBOR_CONFIG ?? {}),
};

export function shouldUseStubs() {
  if (CONFIG.useStubs !== null && CONFIG.useStubs !== undefined) return Boolean(CONFIG.useStubs);

  const forced = new URLSearchParams(location.search).get("stubs");
  if (forced !== null) return !["0", "false", "no"].includes(forced.toLowerCase());

  try {
    const saved = localStorage.getItem("podbor.use_stubs");
    if (saved !== null) return saved !== "false";
  } catch {}

  if (location.protocol === "file:") return true;
  if (location.hostname.endsWith("github.io")) return true;
  return location.port !== "8080";
}
