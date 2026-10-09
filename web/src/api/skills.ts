import { request } from "./client";
import type { components } from "./schema";

export const searchSkills = (q: string, limit = 10) =>
  request<components["schemas"]["Skill"][]>(
    "GET",
    `/skills?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
