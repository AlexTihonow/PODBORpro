import { request } from "./client";
import type { FeedResponse } from "./types";

export interface FeedParams {
  city?: string;
  page?: number;
  per_page?: number;
}

export const getFeed = (params: FeedParams = {}) => {
  const query = new URLSearchParams();
  if (params.city) query.set("city", params.city);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));

  const queryString = query.toString();
  return request<FeedResponse>("GET", queryString ? `/feed?${queryString}` : "/feed");
};
