import { withBase } from "../router.js";
import { mountPublic } from "../shell.js";
import {
  alert,
  badge,
  chip,
  emptyState,
  errorState,
  formatSalary,
  icon,
  logo,
  skeletonLine,
  spinner,
} from "../ui.js";

const PREVIEW_LINKS = [
  { to: "/feed?preview=loading", label: "Лента: загрузка" },
  { to: "/feed?preview=empty", label: "Лента: пусто" },
  { to: "/feed?preview=error", label: "Лента: ошибка" },
  { to: "/feed?preview=simplified", label: "Лента: упрощённый подбор" },
  { to: "/vacancies/4821?preview=loading", label: "Вакансия: загрузка" },
  { to: "/vacancies/4821?preview=error", label: "Вакансия: ошибка" },
  { to: "/applications?preview=empty", label: "Отклики: пусто" },
  { to: "/letters/15?preview=loading", label: "Письмо: загрузка" },
];

export function renderDevPage() {
  mountPublic(`<div class="dev-page container">
    <header class="dev-header">
      ${logo()}
      <a class="btn btn--secondary btn--sm" href="${withBase("/feed")}" data-link data-to="/feed">${icon("arrow")} В приложение</a>
    </header>

    <div class="dev-intro">
      <span class="eyebrow">${icon("settings")} Служебная страница</span>
      <h1 class="page-title">Компоненты и состояния</h1>
      <p class="page-subtitle">Базовые элементы интерфейса и макеты экранов. Данные демонстрационные.</p>
    </div>

    ${section("Кнопки", `<div class="dev-row">
      <button class="btn btn--primary btn--md" type="button">Основная ${icon("arrow")}</button>
      <button class="btn btn--secondary btn--md" type="button">Вторичная</button>
      <button class="btn btn--ghost btn--md" type="button">Призрачная</button>
      <button class="btn btn--danger btn--md" type="button">Опасная</button>
      <button class="btn btn--primary btn--md" type="button">${spinner()}<span>Отправка…</span></button>
      <button class="btn btn--primary btn--md" type="button" disabled>Недоступна</button>
      <button class="btn btn--primary btn--sm" type="button">Маленькая</button>
      <button class="btn btn--primary btn--lg" type="button">Большая</button>
    </div>`)}

    ${section("Поля", `<div class="dev-stack dev-stack--form">
      <div class="field"><label class="field__label" for="dev-input">Обычное поле</label><input class="input" id="dev-input" placeholder="Например, почта" /></div>
      <div class="field"><label class="field__label" for="dev-input-error">Поле с ошибкой</label><input class="input input--invalid" id="dev-input-error" value="ivan@" /><span class="field__error">Похоже, в почте опечатка</span></div>
      <div class="field"><label class="field__label" for="dev-textarea">Текстовая область</label><textarea class="textarea" id="dev-textarea" rows="3" placeholder="Текст письма"></textarea></div>
      <div class="field"><label class="field__label" for="dev-select">Выпадающий список</label><select class="select" id="dev-select"><option>Джуниор</option><option>Мидл</option><option>Сеньор</option></select></div>
    </div>`)}

    ${section("Сообщения", `<div class="dev-stack">
      ${alert("error", "Неверная почта или пароль.")}
      ${alert("warning", "Подбор упрощён: сервис подбора временно недоступен.")}
      ${alert("info", "Резюме обрабатывается — обновим ленту автоматически.")}
      ${alert("success", "Аккаунт создан.")}
    </div>`)}

    ${section("Бейджи и чипы", `<div class="dev-row">
      ${badge("Нейтральный")}${badge("83%", "brand")}${badge("Совпало", "success")}${badge("Не хватает", "warning")}${badge("Ошибка", "danger")}
      ${chip("Go")}${chip("PostgreSQL")}${chip("Docker")}
    </div>`)}

    ${section("Загрузка", `<div class="dev-row">
      <span class="dev-loading">${spinner()} Загружаем…</span>
      <div class="dev-stack" style="width:100%;max-width:420px">
        ${skeletonLine("75%", 20, "margin-bottom:10px")}
        ${skeletonLine("33%", 16, "margin-bottom:10px")}
        ${skeletonLine("100%", 16)}
      </div>
    </div>`)}

    ${section("Пусто и ошибка", `<div class="dev-grid">
      <div class="card">${emptyState({ title: "Подходящих вакансий пока нет", description: "Попробуйте убрать часть фильтров." })}</div>
      <div class="card">${errorState({ title: "Не получилось загрузить ленту", message: "Проверьте подключение к интернету.", retry: false })}</div>
    </div>`)}

    ${section("Краевые случаи вёрстки", `<article class="card vacancy-card" style="max-width:560px">
      <h2 class="vacancy-card__title line-clamp-2">Ведущий инженер-программист по разработке высоконагруженных распределённых систем обработки данных на Go</h2>
      <p class="vacancy-card__company">${formatSalary({ salary_from: null, salary_to: null, currency: null })}</p>
      <p class="vacancy-card__company">${formatSalary({ salary_from: 120000, salary_to: 180000, currency: "RUB" })}</p>
    </article>`)}

    ${section("Макеты экранов", `<p class="field__hint">Параметр <code class="dev-code">?preview=…</code> включает состояние без сервера.</p>
      <div class="dev-links">${PREVIEW_LINKS.map((link) => `<a class="dev-link" href="${withBase(link.to)}" data-link data-to="${link.to}">${link.label}</a>`).join("")}</div>`)}
  </div>`);
}

function section(title, content) {
  return `<section class="dev-section">
    <h2 class="dev-section__title">${title}</h2>
    ${content}
  </section>`;
}
