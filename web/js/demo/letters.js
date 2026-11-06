import { notFound } from "../api/error.js";
import { findVacancy } from "./catalog.js";
import { clone, nowIso } from "./util.js";

const UNVERIFIED_CLAIMS = ["Kubernetes", "запускал кластеры в продакшене", "руководил командой"];

const STORAGE_KEY = "podbor.demo.letters";
const FIRST_ID = 15;

const letters = restore();
let nextId = Math.max(FIRST_ID - 1, ...letters.keys()) + 1;

function restore() {
  try {
    return new Map(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Map();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...letters]));
  } catch {}
}

export async function createLetter(vacancyId, profile) {
  const vacancy = await findVacancy(vacancyId);
  const existing = [...letters.values()].find((entry) => entry.letter.vacancy_id === vacancy.id);
  if (existing) return clone(existing.letter);

  const content = draft(vacancy, profile);
  const createdAt = nowIso();
  const letter = {
    id: nextId++,
    application_id: null,
    vacancy_id: vacancy.id,
    content,
    version: 1,
    unverified: findClaims(content),
    updated_at: createdAt,
  };
  letters.set(letter.id, { letter, versions: [{ version: 1, content, author: "model", created_at: createdAt }] });
  persist();
  return clone(letter);
}

export function getLetter(id) {
  return clone(entry(id).letter);
}

export function listVersions(id) {
  return { items: clone(entry(id).versions) };
}

export function patchLetter(id, body) {
  const current = entry(id);
  const content = String(body.content ?? "");
  const version = Math.max(current.letter.version, Number(body.version) || 0) + 1;
  const updatedAt = nowIso();
  current.letter = { ...current.letter, content, version, unverified: findClaims(content), updated_at: updatedAt };
  current.versions = [{ version, content, author: "user", created_at: updatedAt }, ...current.versions];
  persist();
  return clone(current.letter);
}

function entry(id) {
  const found = letters.get(Number(id));
  if (!found) throw notFound("Письмо не найдено");
  return found;
}

function draft(vacancy, profile) {
  const skills = vacancy.skills
    .map((skill) => skill.name)
    .filter((name) => (profile.skills ?? []).some((own) => own.name.toLowerCase() === name.toLowerCase()));
  const stack = skills.length > 0 ? ` Последние проекты я делал на ${skills.join(", ")}.` : "";
  return [
    "Здравствуйте!",
    `Меня заинтересовала вакансия «${vacancy.title}» в компании ${vacancy.company}.${stack}`,
    "Я работал с Kubernetes и запускал кластеры в продакшене.",
    "Буду рад обсудить задачи команды и рассказать подробнее о своём опыте.",
  ].join(" ");
}

function findClaims(content) {
  return UNVERIFIED_CLAIMS.flatMap((claim) => {
    const start = content.indexOf(claim);
    return start < 0 ? [] : [{ start, end: start + claim.length, text: claim }];
  }).sort((a, b) => a.start - b.start);
}
