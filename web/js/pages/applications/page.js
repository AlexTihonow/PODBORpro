import { clearApplications, deleteApplication, listApplications, moveApplication } from "../../api/index.js";
import { getPathname, navigate, withBase } from "../../core/router.js";
import { mountShell } from "../../ui/shell.js";
import {
  alert,
  companyTone,
  emptyState,
  errorState,
  esc,
  formatDate,
  formatSalary,
  icon,
  initial,
  previewState,
  skeletonLine,
} from "../../ui/components.js";

const COLUMNS = [
  { id: "draft", title: "Черновик", hint: "Открытые из ленты", icon: "edit" },
  { id: "sent", title: "Отправлено", hint: "Ждём ответа", icon: "mail" },
  { id: "interview", title: "Интервью", hint: "Общаемся", icon: "user" },
  { id: "offer", title: "Оффер", hint: "Отличные новости", icon: "star" },
  { id: "rejected", title: "Отказ", hint: "Идём дальше", icon: "x" },
];

// Сколько пикселей нужно протащить карточку, чтобы это считалось перетаскиванием, а не кликом.
const DRAG_THRESHOLD = 6;

export async function renderApplicationsPage(isCurrent) {
  const preview = previewState();
  const main = mountShell("applications", `${hero([])}${boardSkeleton()}`);

  if (preview === "loading") return;

  if (preview === "error") {
    main.innerHTML = `${hero([])}${errorState({
      title: "Не получилось загрузить отклики",
      message: "Проверьте подключение к интернету и попробуйте ещё раз.",
    })}`;
    bindRetry(main);
    return;
  }

  let items = [];
  if (preview !== "empty") {
    try {
      items = (await listApplications()).items ?? [];
    } catch (error) {
      if (!isCurrent()) return;
      main.innerHTML = `${hero([])}${errorState({ title: "Не получилось загрузить отклики", message: error.message })}`;
      bindRetry(main);
      return;
    }
  }
  if (!isCurrent()) return;

  const board = { main, items, error: "" };
  render(board);
  bindBoard(board);
}

// Изменения доски показываются сразу, а потом уходят на сервер. Если сервер
// ответил ошибкой — перечитываем доску с сервера и показываем сообщение.
async function sync(board, request) {
  render(board);
  try {
    await request();
  } catch (error) {
    try {
      board.items = (await listApplications()).items ?? [];
    } catch {}
    board.error = `Не удалось сохранить изменение: ${error.message}`;
    render(board);
  }
}

function render(board) {
  const { main, items } = board;
  const error = board.error ? alert("error", board.error) : "";
  board.error = "";
  if (items.length === 0) {
    main.innerHTML = `${hero(items)}${error}${emptyState({
      title: "Откликов пока нет",
      description: "Откройте подходящую вакансию в ленте — она появится в черновиках, а дальше её можно перетаскивать по этапам.",
      iconName: "board",
      action: `<a class="btn btn--primary btn--md" href="${withBase("/feed")}" data-link data-to="/feed">Перейти к ленте</a>`,
    })}`;
    return;
  }

  main.innerHTML = `
    ${hero(items)}
    ${error}
    <p class="board-tip">${icon("info")} Перетаскивайте карточки между колонками, чтобы менять этап отклика.</p>
    <div class="board" data-board>
      ${COLUMNS.map((column) => boardColumn(column, items)).join("")}
    </div>
  `;
}

function hero(items) {
  const active = items.filter((item) => item.status === "sent" || item.status === "interview").length;
  const offers = items.filter((item) => item.status === "offer").length;

  return `<section class="page-hero">
    <div class="page-hero__text">
      <span class="eyebrow">${icon("board")} Воронка откликов</span>
      <h1 class="page-title">Доска откликов</h1>
      <p class="page-subtitle">Следите за статусами, возвращайтесь к вакансиям и держите поиск под контролем.</p>
    </div>
    <div class="page-hero__aside">
      <div class="hero-stats">
        <div class="hero-stat"><strong>${items.length || "—"}</strong><span>всего</span></div>
        <div class="hero-stat"><strong>${items.length ? active : "—"}</strong><span>в работе</span></div>
        <div class="hero-stat"><strong>${items.length ? offers : "—"}</strong><span>офферов</span></div>
      </div>
    </div>
  </section>`;
}

function columnOf(items, status) {
  return items.filter((item) => item.status === status).sort((a, b) => a.position - b.position);
}

function boardColumn(column, items) {
  const columnItems = columnOf(items, column.id);
  const clearButton =
    column.id === "rejected" && columnItems.length > 0
      ? `<button class="board-column__clear" type="button" data-clear-column="rejected" title="Убрать все отказы с доски">${icon("x")} Очистить все</button>`
      : "";

  return `<section class="board-column board-column--${column.id}" data-column="${column.id}">
    <header class="board-column__header">
      <div class="board-column__title-wrap">
        <span class="board-column__icon">${icon(column.icon)}</span>
        <div>
          <h2 class="board-column__title">${esc(column.title)}</h2>
          <p class="board-column__hint">${esc(column.hint)}</p>
        </div>
      </div>
      <span class="count-badge">${columnItems.length}</span>
    </header>
    ${clearButton}

    <div class="board-column__body" data-drop="${column.id}">
      ${columnItems.map((item) => applicationCard(item)).join("")}
      <div class="board-empty"${columnItems.length ? " hidden" : ""}>${icon("plus")} Перетащите сюда</div>
    </div>
  </section>`;
}

function applicationCard(item) {
  const vacancy = item.vacancy;
  const clear =
    item.status === "rejected"
      ? `<button class="app-card__clear" type="button" data-remove="${item.id}">${icon("x")} Очистить</button>`
      : "";

  return `<article class="app-card" data-card="${item.id}">
    <a class="app-card__link" href="${withBase(`/vacancies/${vacancy.id}`)}" data-link data-to="/vacancies/${vacancy.id}" draggable="false">
      <div class="app-card__top">
        <span class="company-logo company-logo--sm ${companyTone(vacancy.company)}">${esc(initial(vacancy.company))}</span>
        <span class="app-card__grip" aria-hidden="true">⋮⋮</span>
      </div>
      <p class="app-card__title line-clamp-2">${esc(vacancy.title)}</p>
      <p class="app-card__company">${esc(vacancy.company)}</p>
      <p class="app-card__salary">${esc(formatSalary(vacancy))}</p>
      <p class="app-card__date">${icon("clock")} ${esc(formatDate(item.updated_at))}</p>
    </a>
    ${clear}
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

// Переставляет карточку локально так же, как сервер: в колонку status на место position.
function applyMove(items, id, status, position) {
  const item = items.find((other) => other.id === id);
  if (!item) return;
  const from = item.status;
  const column = columnOf(items, status).filter((other) => other.id !== id);
  column.splice(Math.min(position, column.length), 0, item);
  if (from !== status) item.updated_at = new Date().toISOString();
  item.status = status;
  column.forEach((other, index) => {
    other.position = index;
  });
  if (from !== status) columnOf(items, from).forEach((other, index) => (other.position = index));
}

function removeLocal(items, predicate) {
  const rest = items.filter((item) => !predicate(item));
  for (const status of new Set(rest.map((item) => item.status))) {
    columnOf(rest, status).forEach((item, index) => (item.position = index));
  }
  return rest;
}

// Все обработчики вешаются на main один раз: доска перерисовывается через render().
function bindBoard(board) {
  const { main } = board;
  main.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      event.preventDefault();
      const id = Number(remove.dataset.remove);
      remove.closest(".app-card")?.classList.add("app-card--leaving");
      setTimeout(() => {
        board.items = removeLocal(board.items, (item) => item.id === id);
        sync(board, () => deleteApplication(id));
      }, 180);
      return;
    }
    const clearAll = event.target.closest("[data-clear-column]");
    if (clearAll) {
      const status = clearAll.dataset.clearColumn;
      board.items = removeLocal(board.items, (item) => item.status === status);
      sync(board, () => clearApplications(status));
    }
  });

  bindDrag(main, (id, status, position) => {
    const item = board.items.find((other) => other.id === id);
    if (!item) return;
    const before = item.status === status ? columnOf(board.items, status).indexOf(item) : -1;
    if (before === position) {
      render(board);
      return;
    }
    applyMove(board.items, id, status, position);
    sync(board, () => moveApplication(id, status, position));
  });
}

// Перетаскивание на pointer-событиях: одинаково работает мышью, пальцем и пером
// (нативный HTML5 drag-and-drop на телефонах не срабатывает).
// onDrop(id, status, position) вызывается, когда карточку отпустили над колонкой.
function bindDrag(main, onDrop) {
  let drag = null;

  main.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    const card = event.target.closest(".app-card[data-card]");
    if (!card) return;
    drag = { card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  });

  main.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startDrag(event);
    }
    event.preventDefault();
    moveGhost(event);
    updateDropTarget(event);
  });

  main.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.active) finishDrag(true);
    else drag = null;
  });

  main.addEventListener("pointercancel", () => {
    if (drag?.active) finishDrag(false);
    drag = null;
  });

  // После перетаскивания браузер всё равно шлёт click — не даём ему открыть вакансию.
  main.addEventListener(
    "click",
    (event) => {
      if (main.dataset.justDragged) {
        event.preventDefault();
        event.stopPropagation();
        delete main.dataset.justDragged;
      }
    },
    true,
  );

  // Не даём странице прокручиваться пальцем, пока карточка в руке.
  main.addEventListener(
    "touchmove",
    (event) => {
      if (drag?.active) event.preventDefault();
    },
    { passive: false },
  );

  function startDrag(event) {
    const { card } = drag;
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add("app-card--ghost");
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);

    const placeholder = document.createElement("div");
    placeholder.className = "app-card-placeholder";
    placeholder.style.height = `${rect.height}px`;
    card.after(placeholder);
    card.classList.add("app-card--dragging");

    Object.assign(drag, {
      active: true,
      ghost,
      placeholder,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });
    main.querySelector("[data-board]")?.classList.add("board--dragging");
    try {
      card.setPointerCapture(event.pointerId);
    } catch {}
  }

  function moveGhost(event) {
    drag.ghost.style.transform = `translate(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px) rotate(2deg)`;
  }

  function updateDropTarget(event) {
    drag.ghost.style.visibility = "hidden";
    const under = document.elementFromPoint(event.clientX, event.clientY);
    drag.ghost.style.visibility = "";

    const column = under?.closest("[data-column]");
    main.querySelectorAll(".board-column--over").forEach((el) => el !== column && el.classList.remove("board-column--over"));
    if (!column) return;
    column.classList.add("board-column--over");

    const body = column.querySelector("[data-drop]");
    const before = [...body.querySelectorAll(".app-card[data-card]:not(.app-card--dragging)")].find((other) => {
      const rect = other.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const empty = body.querySelector(".board-empty");
    if (before) before.before(drag.placeholder);
    else empty.before(drag.placeholder);
    syncEmptyHints();
  }

  function syncEmptyHints() {
    main.querySelectorAll("[data-drop]").forEach((body) => {
      const hasCards = body.querySelector(".app-card[data-card]:not(.app-card--dragging), .app-card-placeholder");
      body.querySelector(".board-empty").hidden = Boolean(hasCards);
    });
  }

  function finishDrag(commit) {
    const { card, ghost, placeholder } = drag;
    const column = placeholder.closest("[data-drop]");
    ghost.remove();
    drag = null;
    main.dataset.justDragged = "1";
    setTimeout(() => delete main.dataset.justDragged, 0);

    if (!commit || !column) {
      placeholder.remove();
      card.classList.remove("app-card--dragging");
      main.querySelectorAll(".board-column--over").forEach((el) => el.classList.remove("board-column--over"));
      main.querySelector("[data-board]")?.classList.remove("board--dragging");
      syncEmptyHints();
      return;
    }

    // Место в колонке = сколько карточек (кроме перетаскиваемой) стоит перед заглушкой.
    const position = [...column.querySelectorAll(".app-card[data-card], .app-card-placeholder")]
      .filter((el) => el !== card)
      .indexOf(placeholder);
    placeholder.remove();
    onDrop(Number(card.dataset.card), column.dataset.drop, position);
  }
}
