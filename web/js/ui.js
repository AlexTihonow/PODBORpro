import { withBase } from "./router.js";

const ICONS = {
  sparkles:
    '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z"/><circle cx="12" cy="10" r="2.5"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V7"/><path d="M3 12.5h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  upload:
    '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 118 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/>',
  board: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="10" rx="2"/>',
  feed: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.7 8.8a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 6.3"/><path d="M20 4v7h-7"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff:
    '<path d="M3 3l18 18"/><path d="M10.6 6.1A11 11 0 0112 6c6.5 0 10 6 10 6a18 18 0 01-3.2 3.8"/><path d="M6.1 6.7A17 17 0 002 12s3.5 6 10 6a10.7 10.7 0 004.5-1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
};

export function icon(name, className = "icon") {
  const content = ICONS[name] ?? "";
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function initial(value) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function logo({ light = false } = {}) {
  return `<a class="logo${light ? " logo--light" : ""}" href="${withBase("/feed")}" data-link data-to="/feed" aria-label="PODBORpro — на главную">
    <span class="logo__mark">${icon("sparkles", "logo__icon")}</span>
    <span class="logo__name">PODBOR<span>pro</span></span>
  </a>`;
}

export function badge(text, tone = "neutral") {
  return `<span class="badge badge--${tone}">${esc(text)}</span>`;
}

export function chip(text) {
  return `<span class="chip">${esc(text)}</span>`;
}

export function alert(tone, text, attrs = "") {
  const iconName = tone === "error" || tone === "warning" ? "alert" : tone === "success" ? "check" : "info";
  return `<div class="alert alert--${tone}" ${attrs}>${icon(iconName, "alert__icon")}<span>${esc(text)}</span></div>`;
}

export function emptyState({ title, description, iconName = "search", action = "" }) {
  return `<div class="empty-state">
    <span class="state-icon">${icon(iconName)}</span>
    <p class="empty-state__title">${esc(title)}</p>
    <p class="empty-state__desc">${esc(description)}</p>
    ${action}
  </div>`;
}

export function errorState({ title, message, retry = true }) {
  return `<div class="error-state">
    <span class="state-icon state-icon--danger">${icon("alert")}</span>
    <p class="error-state__title">${esc(title)}</p>
    <p class="error-state__desc">${esc(message)}</p>
    ${retry ? `<button class="btn btn--secondary btn--md error-state__retry" type="button" data-retry>${icon("refresh")}<span>Попробовать снова</span></button>` : ""}
  </div>`;
}

export function spinner(className = "spinner") {
  return `<span class="${className}" aria-hidden="true"></span>`;
}

export function pageHero({ eyebrow, title, subtitle, aside = "" }) {
  return `<section class="page-hero">
    <div class="page-hero__text">
      ${eyebrow ? `<span class="eyebrow">${icon("sparkles")}${esc(eyebrow)}</span>` : ""}
      <h1 class="page-title">${esc(title)}</h1>
      ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ""}
    </div>
    ${aside ? `<div class="page-hero__aside">${aside}</div>` : ""}
  </section>`;
}

export function metaItem(iconName, text, extraClass = "") {
  return `<span class="meta-item ${extraClass}">${icon(iconName, "meta-item__icon")}<span>${esc(text)}</span></span>`;
}

export function scoreRing(score, size = "") {
  const percent = Math.round(score * 100);
  const tone = scoreTone(score);
  return `<div class="score-ring score-ring--${tone}${size ? ` score-ring--${size}` : ""}" style="--score:${percent}" title="Совпадение ${percent}%" aria-label="Совпадение ${percent}%">
    <span>${percent}%</span>
  </div>`;
}

export function skeletonLine(width = "100%", height = 14, extra = "") {
  return `<span class="skeleton" style="display:block;width:${width};height:${height}px;${extra}"></span>`;
}

const numberFormat = new Intl.NumberFormat("ru-RU");

const CURRENCY_SYMBOLS = { RUB: "₽", USD: "$", EUR: "€" };

export function formatSalary(value) {
  if (value.salary_from == null && value.salary_to == null) return "Зарплата не указана";
  const symbol = CURRENCY_SYMBOLS[value.currency ?? "RUB"] ?? value.currency ?? "";
  if (value.salary_from != null && value.salary_to != null) {
    return `${numberFormat.format(value.salary_from)}–${numberFormat.format(value.salary_to)} ${symbol}`.trim();
  }
  if (value.salary_from != null) return `от ${numberFormat.format(value.salary_from)} ${symbol}`.trim();
  return `до ${numberFormat.format(value.salary_to)} ${symbol}`.trim();
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function scorePercent(score) {
  return `${Math.round(score * 100)}%`;
}

export function scoreTone(score) {
  if (score >= 0.7) return "good";
  if (score >= 0.4) return "mid";
  return "low";
}

const GRADE_LABELS = { junior: "Джуниор", middle: "Мидл", senior: "Сеньор" };
const WORK_FORMAT_LABELS = { office: "Офис", remote: "Удалённо", hybrid: "Гибрид" };
const APPLICATION_STATUS_LABELS = {
  draft: "Черновик",
  sent: "Отправлено",
  interview: "Интервью",
  offer: "Оффер",
  rejected: "Отказ",
};
const SOURCE_LABELS = { headhunter: "HeadHunter", superjob: "SuperJob" };

export function gradeLabel(grade) {
  return grade ? GRADE_LABELS[grade] ?? grade : "Уровень не указан";
}

export function workFormatLabel(format) {
  return format ? WORK_FORMAT_LABELS[format] ?? format : "";
}

export function applicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? source;
}

export function previewState() {
  const value = new URLSearchParams(location.search).get("preview");
  return ["loading", "empty", "error", "simplified"].includes(value) ? value : null;
}

export function companyTone(seed) {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return `company-logo--${(hash % 5) + 1}`;
}
