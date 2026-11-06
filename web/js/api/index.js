import { requestDemo } from "../demo/index.js";
import { shouldUseStubs } from "./config.js";
import { requestHttp } from "./http.js";

export { ApiError } from "./error.js";
export { getCachedFeedItem } from "../demo/feed.js";

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
export const getFeed = (params = {}) => request("GET", withQuery("/feed", params, ["city", "page", "per_page"]));
export const getVacancy = (id) => request("GET", `/vacancies/${id}`);
export const listApplications = (params = {}) =>
  request("GET", withQuery("/applications", params, ["status", "page", "per_page"]));
export const createLetter = (vacancyId, tone) =>
  request("POST", `/vacancies/${vacancyId}/letters`, tone ? { tone } : undefined);
export const getLetter = (id) => request("GET", `/letters/${id}`);
export const patchLetter = (id, content, version) => request("PATCH", `/letters/${id}`, { content, version });
export const listLetterVersions = (id) => request("GET", `/letters/${id}/versions`);
