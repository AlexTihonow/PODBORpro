import { request } from "./client";
import type { Application, ApplicationPage, ApplicationStatus } from "./types";

export interface ApplicationListParams {
  status?: ApplicationStatus;
  page?: number;
  per_page?: number;
}

export const listApplications = (params: ApplicationListParams = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  const queryString = query.toString();
  return request<ApplicationPage>(
    "GET",
    queryString ? `/applications?${queryString}` : "/applications",
  );
};

export const createApplication = (vacancyId: number) =>
  request<Application>("POST", "/applications", { vacancy_id: vacancyId });

export const patchApplication = (id: number, status: ApplicationStatus) =>
  request<Application>("PATCH", `/applications/${id}`, { status });
