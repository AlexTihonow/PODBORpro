import { notFound } from "../api/error.js";

const CATALOG_URL = "data/vacancies.json";

let catalog = null;

export function loadCatalog() {
  catalog ??= fetch(CATALOG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`catalog ${response.status}`);
      return response.json();
    })
    .catch(() => ({ generated_at: null, model: null, items: [] }));
  return catalog;
}

export async function listVacancies() {
  return (await loadCatalog()).items;
}

export async function findVacancy(id) {
  const vacancy = (await listVacancies()).find((item) => item.id === Number(id));
  if (!vacancy) throw notFound("Вакансия не найдена");
  return vacancy;
}

export function toCard(vacancy) {
  const { description, tags, labels, needs_review, ...card } = vacancy;
  return card;
}
