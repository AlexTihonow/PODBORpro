import { notFound } from "../api/error.js";
import { listVacancies, toCard } from "./catalog.js";
import { clone, nowIso } from "./util.js";

const STATUSES = ["draft", "sent", "interview", "offer", "rejected", "sent", "draft"];
const DAY = 864e5;

let applications = null;

async function all() {
  if (applications) return applications;
  const vacancies = (await listVacancies()).slice(0, STATUSES.length);
  const start = Date.now();
  applications = vacancies.map((vacancy, index) => {
    const updatedAt = new Date(start - index * DAY).toISOString();
    return {
      id: 100 + index,
      vacancy: toCard(vacancy),
      status: STATUSES[index],
      letter_id: null,
      created_at: updatedAt,
      updated_at: updatedAt,
    };
  });
  return applications;
}

export async function listApplications(query) {
  const status = query.get("status");
  const items = (await all()).filter((item) => !status || item.status === status);
  return { items: clone(items), total: items.length };
}

export async function patchApplication(id, body) {
  const item = (await all()).find((application) => application.id === id);
  if (!item) throw notFound("Отклик не найден");
  item.status = body.status ?? item.status;
  item.updated_at = nowIso();
  return clone(item);
}

export async function linkLetter(vacancyId, letterId) {
  const item = (await all()).find((application) => application.vacancy.id === vacancyId);
  if (item) item.letter_id = letterId;
}
