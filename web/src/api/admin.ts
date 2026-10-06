import { request } from "./client";
import type { CollectionRunPage, DataQuality } from "./types";

export const listCollectionRuns = (params: { source?: string; page?: number; per_page?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  const queryString = query.toString();
  return request<CollectionRunPage>(
    "GET",
    queryString ? `/admin/collection-runs?${queryString}` : "/admin/collection-runs",
  );
};

export const getDataQuality = () => request<DataQuality>("GET", "/admin/data-quality");
