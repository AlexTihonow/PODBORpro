// Генерирует 01-gantt.html: план по arc.md с новыми сроками на 20.10.2026, в виде как в исходном архиве.
// Колонки «был старт / было дней» и состояние оставлены для справки, на диаграмму не выводятся.
// Запуск: node docs/plan/src/gantt.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const START = new Date("2026-09-28");
const DAYS = 84;
const TODAY = "2026-10-20";
const LABEL_W = 300;
const TL_W = 900;
const DAY = TL_W / DAYS;

const day = (s) => Math.round((new Date(s) - START) / 86400000);
const x = (s) => day(s) * DAY;

// [номер, название, был старт, было дней, стал старт, стало дней, состояние, критический путь]
// состояние: done — готово, part — начато/на заглушках, todo — не начато
const sections = [
  ["Архитектор", "+ инженер по данным", "arch", [
    ["А-1", "Устав и границы", "2026-09-28", 7, "2026-09-28", 7, "done"],
    ["А-2", "Схемы и потоки данных", "2026-09-28", 14, "2026-09-28", 14, "done"],
    ["А-3", "Журнал решений", "2026-10-12", 7, "2026-10-12", 7, "done"],
    ["А-4", "Схема базы", "2026-10-05", 14, "2026-10-05", 21, "part", 1],
    ["А-9", "Демонстрационный набор", "2026-10-12", 7, "2026-10-20", 6, "todo"],
    ["А-5", "Приведение к единому виду", "2026-10-12", 14, "2026-10-26", 9, "todo", 1],
    ["А-6", "Справочник навыков", "2026-10-12", 21, "2026-10-26", 21, "todo"],
    ["А-7", "Склейка дублей", "2026-10-19", 14, "2026-11-02", 14, "todo"],
    ["А-8", "Индексы и замеры", "2026-11-02", 14, "2026-11-09", 14, "todo"],
    ["А-10", "Качество данных", "2026-11-23", 14, "2026-11-23", 14, "todo"],
    ["А-11", "Итоговое описание", "2026-12-07", 14, "2026-12-07", 14, "todo"],
  ]],
  ["Серверная часть", "+ руководитель", "back", [
    ["С-1", "Каркас сервера на Go", "2026-09-28", 7, "2026-09-28", 7, "done"],
    ["С-2", "Регистрация и вход", "2026-10-05", 7, "2026-10-05", 7, "done"],
    ["С-3", "Описание REST-интерфейса", "2026-10-05", 7, "2026-10-05", 14, "done"],
    ["С-16", "Порядок в репозитории", null, 0, "2026-10-20", 3, "todo"],
    ["С-4", "Очередь и планировщик", "2026-10-12", 7, "2026-10-20", 6, "part", 1],
    ["С-6", "Загрузка резюме", "2026-10-26", 7, "2026-11-02", 7, "todo"],
    ["С-9", "Персональная лента", "2026-10-26", 14, "2026-10-29", 11, "todo", 1],
    ["С-13", "Развёртывание", "2026-11-02", 7, "2026-11-02", 7, "todo"],
    ["С-10", "Черновики писем", "2026-11-09", 14, "2026-11-09", 14, "todo", 1],
    ["С-15", "Работа при отказах", "2026-11-30", 7, "2026-11-30", 7, "todo"],
    ["С-14", "Исправление ошибок", "2026-12-07", 7, "2026-12-07", 7, "todo"],
  ]],
  ["Младший бэкенд", "+ помощь тестам", "jr", [
    ["СМ-1", "Вход в проект, тесты store", null, 0, "2026-10-20", 6, "todo"],
    ["С-5", "Адреса вакансий", "2026-10-12", 14, "2026-10-26", 7, "todo"],
    ["С-8", "Адреса портфолио", "2026-11-02", 7, "2026-11-02", 7, "todo"],
    ["СМ-2", "Проверки REST вместе с Т-5", null, 0, "2026-11-09", 7, "todo"],
    ["С-11", "Отклики и статусы", "2026-11-23", 7, "2026-11-16", 7, "todo"],
    ["С-7", "Подключение GitHub", "2026-10-26", 14, "2026-11-23", 7, "todo"],
    ["С-12", "Журнал сбора, оповещения", "2026-11-23", 14, "2026-11-30", 7, "todo"],
    ["СМ-3", "Исправление ошибок", null, 0, "2026-12-07", 7, "todo"],
  ]],
  ["Клиентская часть", "+ дизайнер", "front", [
    ["К-2", "Макеты экранов", "2026-09-28", 14, "2026-09-28", 14, "done"],
    ["К-1", "Каркас приложения", "2026-09-28", 14, "2026-09-28", 14, "done"],
    ["К-3", "Вход и регистрация", "2026-10-05", 14, "2026-10-05", 14, "done"],
    ["К-4", "Лента на заглушках", "2026-10-12", 14, "2026-10-12", 14, "done"],
    ["К-13", "Переход на настоящий сервер", null, 0, "2026-10-20", 20, "todo"],
    ["К-11", "Ошибки, пустые, телефон", "2026-11-23", 14, "2026-10-26", 14, "todo"],
    ["К-5", "Карточка и разбор оценки", "2026-10-26", 7, "2026-10-26", 7, "part"],
    ["К-6", "Первичная настройка", "2026-10-26", 14, "2026-10-26", 14, "part"],
    ["К-7", "Профиль и портфолио", "2026-11-02", 7, "2026-11-02", 7, "todo"],
    ["К-8", "Редактор письма", "2026-11-09", 14, "2026-11-09", 14, "part", 1],
    ["К-9", "Выгрузка письма", "2026-11-16", 7, "2026-11-16", 7, "todo"],
    ["К-10", "Доска откликов", "2026-11-23", 7, "2026-11-23", 7, "part"],
    ["К-12", "Доводка внешнего вида", "2026-12-07", 7, "2026-12-07", 7, "todo"],
  ]],
  ["Машинное обучение", "+ тех. писатель", "ml", [
    ["М-1", "Выбор модели векторов", "2026-09-28", 14, "2026-09-28", 28, "part"],
    ["М-2", "Сервис моделей и векторы", "2026-10-12", 14, "2026-10-20", 12, "part", 1],
    ["М-3", "Разбор резюме", "2026-10-19", 14, "2026-10-26", 14, "todo"],
    ["М-4", "Эталонная выборка", "2026-10-26", 3, "2026-10-27", 2, "todo", 1],
    ["М-5", "Формула оценки", "2026-10-29", 11, "2026-10-29", 11, "todo", 1],
    ["М-10", "Замер качества в проверке", "2026-11-02", 5, "2026-11-04", 5, "todo"],
    ["М-6", "Задание для модели", "2026-11-09", 7, "2026-11-09", 7, "todo", 1],
    ["М-7", "Сравнение двух заданий", "2026-11-16", 7, "2026-11-16", 7, "todo"],
    ["М-8", "Проверка выдуманного", "2026-11-16", 7, "2026-11-16", 7, "todo"],
    ["М-9", "Точная настройка весов", "2026-11-23", 14, "2026-11-23", 14, "todo"],
    ["М-11", "Документация и отчёт", "2026-12-07", 14, "2026-12-07", 14, "todo"],
  ]],
  ["Тестирование", "+ сборщики", "qa", [
    ["Т-1", "План тестирования", "2026-09-28", 7, "2026-09-28", 7, "done"],
    ["Т-2", "Сквозные тесты в проверке", "2026-09-28", 14, "2026-09-28", 14, "done"],
    ["Т-3", "Сборщик HeadHunter", "2026-10-12", 14, "2026-10-20", 12, "part", 1],
    ["Т-6", "Заглушки источников", "2026-10-19", 7, "2026-10-26", 7, "part"],
    ["Т-5", "Проверки REST-интерфейса", "2026-10-19", 21, "2026-10-26", 21, "todo"],
    ["Т-4", "Сборщик SuperJob", "2026-10-26", 14, "2026-11-09", 14, "todo"],
    ["Т-7", "Сквозной сценарий целиком", "2026-11-09", 14, "2026-11-09", 14, "todo", 1],
    ["Т-8", "Нагрузочная проверка", "2026-11-16", 7, "2026-11-16", 7, "todo"],
    ["Т-9", "Проверка приватности", "2026-11-23", 7, "2026-11-23", 7, "todo"],
    ["Т-10", "Повторная проверка", "2026-11-30", 14, "2026-11-30", 14, "todo"],
    ["Т-12", "Проверка отказов", "2026-11-30", 7, "2026-11-30", 7, "todo"],
    ["Т-11", "Приёмка", "2026-12-14", 7, "2026-12-14", 7, "todo"],
  ]],
];

// [код, было, стало, подпись, пройдена]
const milestones = [
  ["В1", "2026-10-11", "2026-10-18", "REST-интерфейс описан", true],
  ["В2", "2026-10-25", "2026-11-01", "Данные в базе, лента работает", false],
  ["В3", "2026-11-08", "2026-11-08", "Минимальная рабочая версия", false],
  ["В4", "2026-11-22", "2026-11-22", "Полный путь до письма", false],
  ["В5", "2026-12-06", "2026-12-06", "Новые возможности закрыты", false],
  ["В6", "2026-12-20", "2026-12-20", "Защита проекта", false],
];

const fmt = (s) => s.slice(8, 10) + "." + s.slice(5, 7);
const addDays = (s, n) => { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

let weeks = "";
for (let w = 0; w < 12; w++) {
  weeks += `<div class="wk" style="left:${w * 7 * DAY}px;width:${7 * DAY}px"><b>Н${w + 1}</b><span>${fmt(addDays("2026-09-28", w * 7))}</span></div>`;
}
const grid = Array.from({ length: 13 }, (_, w) => `<div class="vl" style="left:${w * 7 * DAY}px"></div>`).join("");
const msLines = milestones.map(([, , n]) => `<div class="ml" style="left:${x(n)}px"></div>`).join("");
const todayLine = `<div class="today" style="left:${x(TODAY)}px"></div>`;
const overlay = (extra = "") => `<div class="ov">${grid}${msLines}${extra}</div>`;

let msRow = "";
for (const [code, was, now, , passed] of milestones) {
  const cls = code === "В3" ? "crit" : "";
  msRow += `<div class="ms ${cls}" style="left:${x(now)}px"></div><div class="msl ${code === "В3" ? "red" : ""}" style="left:${x(now)}px">${code} ${fmt(now)}</div>`;
}

let body = "";
for (const [title, extra, role, tasks] of sections) {
  body += `<div class="sec"><div class="lab"><span class="sq" style="background:var(--${role})"></span><b>${title}</b> <span class="muted">${extra}</span></div><div class="tl">${overlay()}</div></div>`;
  for (const [id, name, os, od, ns, nd, st, crit] of tasks) {
    const moved = os && (os !== ns || od !== nd);
    const fresh = !os;
    const color = crit ? "var(--crit)" : `var(--${role})`;
    const ghost = "";
    const mark = "";
    const bar = `<div class="bar" style="left:${x(ns)}px;width:${Math.max(nd * DAY, 8)}px;--c:${color}">${id}${mark}</div>`;
    const tag = "";
    body += `<div class="row"><div class="lab"><span class="id">${id}</span><span class="${crit ? "b" : ""}">${name}</span>${tag}</div><div class="tl">${overlay(ghost + bar)}</div></div>`;
  }
}

const footer = milestones
  .map(([c, was, now, label, passed]) => `<div><span class="mono ${c === "В3" ? "red" : ""}">${c} ${fmt(now)}</span><br>${label}</div>`)
  .join("");

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Диаграмма Ганта</title>
<link rel="stylesheet" href="style.css">
<style>
@page { size: 1290px 1900px; margin: 0; }
.wrap { width: ${LABEL_W + TL_W}px; }
.head, .row, .sec, .msrow { display: flex; }
.lab { width: ${LABEL_W}px; flex: none; font-size: 12.5px; display: flex; align-items: center; gap: 8px; padding-right: 8px; }
.tl { position: relative; width: ${TL_W}px; flex: none; }
.ov { position: absolute; inset: 0; }
.vl { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--line); }
.ml { position: absolute; top: 0; bottom: 0; border-left: 1px dashed #a9a395; }
.today { position: absolute; top: 0; bottom: 0; border-left: 2px solid var(--crit); opacity: .55; }
.head { border-bottom: 1.5px solid var(--ink); height: 40px; font-size: 11px; }
.head .lab { font-family: var(--mono); color: var(--muted); align-items: flex-end; padding-bottom: 6px; }
.wk { position: absolute; top: 4px; padding-left: 4px; border-left: 1px solid var(--line); height: 36px; }
.wk b { display: block; font-family: var(--mono); font-weight: 500; font-size: 11px; }
.wk span { font-family: var(--mono); color: var(--muted); font-size: 10px; }
.msrow { height: 38px; border-bottom: 1px solid var(--line); }
.msrow .lab { font-weight: 700; font-size: 13px; }
.ms { position: absolute; top: 7px; width: 10px; height: 10px; margin-left: -5px; background: var(--ink); transform: rotate(45deg); }
.ms.crit { background: var(--crit); }
.ms.done { background: var(--ok); }
.ms.ghost { background: none; border: 1.5px solid #a9a395; }
.msl { position: absolute; top: 21px; transform: translateX(-50%); font-family: var(--mono); font-size: 10px; white-space: nowrap; }
.red { color: var(--crit); }
.sec { height: 30px; margin-top: 6px; border-top: 1px solid var(--line); }
.sec .lab { font-size: 13px; }
.sq { width: 9px; height: 9px; display: inline-block; }
.row { height: 20px; }
.id { font-family: var(--mono); color: var(--muted); width: 38px; flex: none; font-size: 11px; }
.b { font-weight: 700; }
.bar { position: absolute; top: 3px; height: 14px; background: var(--c); color: #fff; font-family: var(--mono); font-size: 9.5px; padding-left: 4px; line-height: 14px; white-space: nowrap; overflow: hidden; }
.bar.done { background: var(--done); opacity: .75; }
.bar.part { background: repeating-linear-gradient(135deg, var(--c) 0 6px, color-mix(in srgb, var(--c) 70%, white) 6px 9px); }
.ghost { position: absolute; top: 3px; height: 14px; border: 1.2px dashed #9b9588; }
.tag { font-family: var(--mono); font-size: 9.5px; padding: 0 4px; border: 1px solid var(--line); color: var(--muted); margin-left: auto; }
.tag.mv { border-color: var(--part); color: #8f6418; }
.tag:not(.mv) { border-color: var(--arch); color: var(--arch); }
.foot { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 16px; padding-top: 10px; border-top: 1.5px solid var(--ink); font-size: 12px; line-height: 1.5; width: ${LABEL_W + TL_W}px; }
.lg-done { background: var(--done); opacity: .75; }
.lg-part { background: repeating-linear-gradient(135deg, var(--back) 0 6px, #9cbcad 6px 9px); }
.lg-ghost { border: 1.2px dashed #9b9588; }
.lg-today { width: 2px !important; height: 14px !important; background: var(--crit); opacity: .55; }
</style></head><body>
<div class="kicker">01</div>
<h1>Диаграмма Ганта, 28.09 — 20.12.2026</h1>
<div class="legend">
  <span><i style="background:var(--arch)"></i>Архитектор</span>
  <span><i style="background:var(--back)"></i>Серверная часть</span>
  <span><i style="background:var(--jr)"></i>Младший бэкенд</span>
  <span><i style="background:var(--front)"></i>Клиентская часть</span>
  <span><i style="background:var(--ml)"></i>Машинное обучение</span>
  <span><i style="background:var(--qa)"></i>Тестирование</span>
  <span><i style="background:var(--crit)"></i>Критический путь</span>
  <span>◆ Веха</span>
</div>
<div class="wrap">
  <div class="head"><div class="lab">ЗАДАЧА</div><div class="tl">${weeks}</div></div>
  <div class="msrow"><div class="lab">Вехи</div><div class="tl">${overlay(msRow)}</div></div>
  ${body}
</div>
<div class="foot">${footer}</div>
</body></html>`;

writeFileSync(join(here, "01-gantt.html"), html);
console.log("ok");
