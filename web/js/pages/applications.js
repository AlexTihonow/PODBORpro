import { listApplications } from "../api.js";
import { getPathname, navigate, withBase } from "../router.js";
import { mountShell } from "../shell.js";
import {
  applicationStatusLabel,
  companyTone,
  emptyState,
  errorState,
  esc,
  formatDate,
  icon,
  initial,
  previewState,
  skeletonLine,
} from "../ui.js";

const COLUMNS = [
  { id: "draft", title: "Черновик", hint: "Готовим письмо", icon: "edit" },
  { id: "sent", title: "Отправлено", hint: "Ждём ответа", icon: "mail" },
  { id: "interview", title: "Интервью", hint: "Общаемся", icon: "user" },
  { id: "offer", title: "Оффер", hint: "Отличные новости", icon: "star" },
  { id: "rejected", title: "Отказ", hint: "Идём дальше", icon: "x" },
];

export async function renderApplicationsPage(isCurrent) {
  const preview = previewState();
  const main = mountShell("applications", `${hero([])}${boardSkeleton()}`);
  bindRetry(main);

  if (preview === "loading") return;

  if (preview === "empty") {
    main.innerHTML = `${hero([])}${emptyState({
      title: "Откликов пока нет",
      description: "Откройте подходящую вакансию и составьте первое письмо.",
      iconName: "board",
      action: `<a class="btn btn--primary btn--md" href="${withBase("/feed")}" data-link data-to="/feed">Перейти к ленте</a>`,
    })}`;
    return;
  }

  if (preview === "error") {
    main.innerHTML = `${hero([])}${errorState({
      title: "Не получилось загрузить отклики",
      message: "Проверьте подключение к интернету и попробуйте ещё раз.",
    })}`;
    bindRetry(main);
    return;
  }

  let data;
  try {
    data = await listApplications();
  } catch (error) {
    if (!isCurrent()) return;
    main.innerHTML = `${hero([])}${errorState({
      title: "Не получилось загрузить отклики",
      message: error.message,
    })}`;
    bindRetry(main);
    return;
  }

  if (!isCurrent()) return;

  const applications = data.items ?? [];

  if (applications.length === 0) {
    main.innerHTML = `${hero([])}${emptyState({
      title: "Откликов пока нет",
      description: "Откройте подходящую вакансию и составьте первое письмо.",
      iconName: "board",
      action: `<a class="btn btn--primary btn--md" href="${withBase("/feed")}" data-link data-to="/feed">Перейти к ленте</a>`,
    })}`;
    return;
  }

  main.innerHTML = `
    ${hero(applications)}
    <div class="board">
      ${COLUMNS.map((column) => boardColumn(column, applications)).join("")}
    </div>
  `;
}

function hero(applications) {
  const active = applications.filter((item) => item.status === "sent" || item.status === "interview").length;
  const offers = applications.filter((item) => item.status === "offer").length;

  return `<section class="page-hero">
    <div class="page-hero__text">
      <span class="eyebrow">${icon("board")} Воронка откликов</span>
      <h1 class="page-title">Доска откликов</h1>
      <p class="page-subtitle">Следите за статусами, возвращайтесь к письмам и держите поиск под контролем.</p>
    </div>
    <div class="page-hero__aside">
      <div class="hero-stats">
        <div class="hero-stat"><strong>${applications.length || "—"}</strong><span>всего</span></div>
        <div class="hero-stat"><strong>${applications.length ? active : "—"}</strong><span>в работе</span></div>
        <div class="hero-stat"><strong>${applications.length ? offers : "—"}</strong><span>офферов</span></div>
      </div>
    </div>
  </section>`;
}

function boardColumn(column, applications) {
  const items = applications.filter((item) => item.status === column.id);

  return `<section class="board-column board-column--${column.id}">
    <header class="board-column__header">
      <div class="board-column__title-wrap">
        <span class="board-column__icon">${icon(column.icon)}</span>
        <div>
          <h2 class="board-column__title">${esc(column.title)}</h2>
          <p class="board-column__hint">${esc(column.hint)}</p>
        </div>
      </div>
      <span class="count-badge">${items.length}</span>
    </header>

    <div class="board-column__body">
      ${items.map((application) => applicationCard(application)).join("")}
      ${items.length === 0 ? `<div class="board-empty">${icon("plus")} Нет откликов</div>` : ""}
    </div>
  </section>`;
}

function applicationCard(application) {
  const vacancy = application.vacancy;
  return `<article class="app-card">
    <a class="app-card__link" href="${withBase(`/vacancies/${vacancy.id}`)}" data-link data-to="/vacancies/${vacancy.id}">
      <div class="app-card__top">
        <span class="company-logo company-logo--sm ${companyTone(vacancy.company)}">${esc(initial(vacancy.company))}</span>
        <span class="app-card__status">${esc(applicationStatusLabel(application.status))}</span>
      </div>
      <p class="app-card__title line-clamp-2">${esc(vacancy.title)}</p>
      <p class="app-card__company">${esc(vacancy.company)}</p>
      <p class="app-card__date">${icon("clock")} ${esc(formatDate(application.updated_at))}</p>
    </a>
    ${
      application.letter_id
        ? `<a class="app-card__letter" href="${withBase(`/letters/${application.letter_id}`)}" data-link data-to="/letters/${application.letter_id}">${icon("file")} Открыть письмо</a>`
        : ""
    }
  </article>`;
}

function boardSkeleton() {
  return `<div class="board">
    ${COLUMNS.map(
      (column) => `<section class="board-column board-column--${column.id}">
        <header class="board-column__header">
          <div class="board-column__title-wrap">
            ${skeletonLine("120px", 18)}
          </div>
        </header>
        <div class="board-column__body">
          ${skeletonLine("100%", 118, "margin-bottom:10px")}
          ${skeletonLine("100%", 118)}
        </div>
      </section>`,
    ).join("")}
  </div>`;
}

function bindRetry(main) {
  main.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => navigate(`${getPathname()}${location.search}`));
  });
}
