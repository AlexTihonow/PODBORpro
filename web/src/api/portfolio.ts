import { request } from "./client";
import type { components } from "./schema";

export const uploadResume = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<components["schemas"]["ResumeUploadResponse"]>("POST", "/portfolio/resume", form);
};

export const connectGithub = (username: string) =>
  request<components["schemas"]["PortfolioItemList"]>("POST", "/portfolio/github", { username });

export const listPortfolioItems = () =>
  request<components["schemas"]["PortfolioItemList"]>("GET", "/portfolio/items");

export const createPortfolioItem = (body: components["schemas"]["PortfolioItemCreate"]) =>
  request<components["schemas"]["PortfolioItem"]>("POST", "/portfolio/items", body);

export const patchPortfolioItem = (id: number, body: components["schemas"]["PortfolioItemPatch"]) =>
  request<components["schemas"]["PortfolioItem"]>("PATCH", `/portfolio/items/${id}`, body);

export const deletePortfolioItem = (id: number) =>
  request<void>("DELETE", `/portfolio/items/${id}`);
