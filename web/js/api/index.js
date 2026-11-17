import { requestDemo } from "../demo/index.js";
import { shouldUseStubs } from "./config.js";
import { requestHttp } from "./http.js";

export { ApiError } from "./error.js";
export { getCachedFeedItem } from "../demo/feed.js";
export { listSkillNames, listTagTree, skillKey } from "../demo/catalog.js";

function request(method, path, body, options) {
  return shouldUseStubs() ? requestDemo(method, path, body) : requestHttp(method, path, body, options);
}

function withQuery(path, params, keys) {
  const query = new URLSearchParams();
  for (const key of keys) {
    if (params[key]) query.set(key, String(params[key]));
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const login = (email, password) => request("POST", "/auth/login", { email, password });
export const register = (body) => request("POST", "/auth/register", body);
export const getMe = () => request("GET", "/me");
export const patchMe = (body) => request("PATCH", "/me", body);
// Резюме разбирается на сервере правилами (без нейросети); ответ — resume_status и parsed.
export function uploadResume(file) {
  const form = new FormData();
  form.append("file", file, file.name);
  return request("POST", "/portfolio/resume", form);
}
// Лента и вакансии на сервере пока заглушки из OpenAPI (заголовок X-Stub) с
// выдуманной вакансией №4821, которой нет в каталоге. Пока так, берём их из
// того же каталога data/vacancies.json, по которому сервер составляет письма.
async function catalogRequest(path) {
  if (shouldUseStubs()) return requestDemo("GET", path);
  try {
    return await requestHttp("GET", path, undefined, { rejectStub: true });
  } catch (error) {
    if (error.code !== "stub") throw error;
    return requestDemo("GET", path);
  }
}

export const getFeed = (params = {}) => catalogRequest(withQuery("/feed", params, ["city", "page", "per_page"]));
export const getVacancy = (id) => catalogRequest(`/vacancies/${id}`);
// Доска откликов: на сервере хранится в базе, в демо-режиме — в localStorage.
export const listApplications = (params = {}) => request("GET", withQuery("/applications", params, ["status"]));
export const createApplication = (vacancyId) => request("POST", "/applications", { vacancy_id: vacancyId });
// position — место в колонке status (0 — сверху); без него карточка встаёт в конец колонки.
export const moveApplication = (id, status, position) =>
  request("PATCH", `/applications/${id}`, position === undefined ? { status } : { status, position });
export const deleteApplication = (id) => request("DELETE", `/applications/${id}`);
export const clearApplications = (status) => request("DELETE", withQuery("/applications", { status }, ["status"]));
export const createLetter = (vacancyId, tone) =>
  request("POST", `/vacancies/${vacancyId}/letters`, tone ? { tone } : undefined);

// Письмо через модель на сервере (не сохраняется). В демо-режиме и когда сервер
// недоступен — локальный черновик, помеченный demo: true.
export async function generateCoverLetter(vacancyId, options = {}) {
  const path = `/vacancies/${vacancyId}/cover-letter`;
  if (shouldUseStubs()) return { ...(await requestDemo("POST", path)), demo: true };
  try {
    return await requestHttp("POST", path, undefined, options);
  } catch (error) {
    if (error.status !== 0 || options.signal?.aborted) throw error;
    try {
      return { ...(await requestDemo("POST", path)), demo: true, offline: true };
    } catch {
      throw error;
    }
  }
}

// Готовый промт для внешней нейросети (если письмо не составилось).
export async function getCoverLetterPrompt(vacancyId) {
  const path = `/vacancies/${vacancyId}/cover-letter/prompt`;
  if (shouldUseStubs()) return requestDemo("GET", path);
  try {
    return await requestHttp("GET", path);
  } catch (error) {
    if (error.status !== 0) throw error;
    return requestDemo("GET", path).catch(() => {
      throw error;
    });
  }
}

export const getLetter = (id) => request("GET", `/letters/${id}`);
export const patchLetter = (id, content, version) => request("PATCH", `/letters/${id}`, { content, version });
export const listLetterVersions = (id) => request("GET", `/letters/${id}/versions`);
