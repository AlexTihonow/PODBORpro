import { request } from "./client";
import type { components } from "./schema";

export interface VacancyListParams {
  q?: string;
  city?: string;
  grade?: components["schemas"]["Grade"];
  work_format?: components["schemas"]["WorkFormat"];
  salary_from?: number;
  skill_id?: number[];
  page?: number;
  per_page?: number;
}

export const listVacancies = (params: VacancyListParams = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  if (params.grade) query.set("grade", params.grade);
  if (params.work_format) query.set("work_format", params.work_format);
  if (params.salary_from != null) query.set("salary_from", String(params.salary_from));
  for (const id of params.skill_id ?? []) query.append("skill_id", String(id));
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  const queryString = query.toString();
  return request<components["schemas"]["VacancyPage"]>(
    "GET",
    queryString ? `/vacancies?${queryString}` : "/vacancies",
  );
};

export const getVacancy = (id: number) =>
  request<components["schemas"]["VacancyDetails"]>("GET", `/vacancies/${id}`);
