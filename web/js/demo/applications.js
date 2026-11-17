// Демо-версия доски откликов: повторяет поведение сервера (позиции в колонке
// плотные, 0 — сверху), а хранит всё в localStorage браузера.
import { ApiError, notFound } from "../api/error.js";
import { findVacancy, toCard } from "./catalog.js";
import { clone, nowIso } from "./util.js";

const KEY = "podbor.demo.applications";
const STATUSES = ["draft", "sent", "interview", "offer", "rejected"];

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

function sorted(items) {
  return [...items].sort(
    (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || a.position - b.position || a.id - b.id,
  );
}

function renumber(items, status) {
  sorted(items)
    .filter((item) => item.status === status)
    .forEach((item, index) => {
      item.position = index;
    });
}

function validation(message) {
  return new ApiError(400, "validation_error", message);
}

export async function listApplications(query) {
  const status = query.get("status");
  const items = sorted(load()).filter((item) => !status || item.status === status);
  return { items: clone(items), total: items.length };
}

export async function createApplication(body) {
  const vacancyId = Number(body.vacancy_id);
  const items = load();
  if (items.some((item) => item.vacancy.id === vacancyId)) {
    throw new ApiError(409, "application_exists", "Отклик на эту вакансию уже создан");
  }
  const vacancy = await findVacancy(vacancyId);
  const now = nowIso();
  items.forEach((item) => {
    if (item.status === "draft") item.position += 1;
  });
  const item = {
    id: items.reduce((max, other) => Math.max(max, other.id), 0) + 1,
    vacancy: toCard(vacancy),
    status: "draft",
    position: 0,
    letter_id: null,
    created_at: now,
    updated_at: now,
  };
  items.push(item);
  save(items);
  return clone(item);
}

export async function patchApplication(id, body) {
  if (!STATUSES.includes(body.status)) throw validation("status — одно из: draft, sent, interview, offer, rejected");
  const items = load();
  const item = items.find((application) => application.id === id);
  if (!item) throw notFound("Отклик не найден");

  const from = item.status;
  const column = sorted(items).filter((other) => other.status === body.status && other.id !== id);
  const at = Number.isInteger(body.position) ? Math.min(Math.max(body.position, 0), column.length) : column.length;
  column.splice(at, 0, item);
  if (from !== body.status) item.updated_at = nowIso();
  item.status = body.status;
  column.forEach((other, index) => {
    other.position = index;
  });
  if (from !== body.status) renumber(items, from);
  save(items);
  return clone(item);
}

export async function deleteApplication(id) {
  const items = load();
  const item = items.find((application) => application.id === id);
  if (!item) throw notFound("Отклик не найден");
  const rest = items.filter((application) => application.id !== id);
  renumber(rest, item.status);
  save(rest);
  return null;
}

export async function deleteApplications(query) {
  const status = query.get("status");
  if (!STATUSES.includes(status)) throw validation("status — одно из: draft, sent, interview, offer, rejected");
  save(load().filter((item) => item.status !== status));
  return null;
}

export async function linkLetter(vacancyId, letterId) {
  const items = load();
  const item = items.find((application) => application.vacancy.id === vacancyId);
  if (item) {
    item.letter_id = letterId;
    save(items);
  }
}
