import { request } from "./client";
import type { Letter, LetterVersionList, Tone } from "./types";

export const createLetter = (vacancyId: number, tone?: Tone) =>
  request<Letter>("POST", `/vacancies/${vacancyId}/letters`, tone ? { tone } : undefined);

export const getLetter = (id: number) => request<Letter>("GET", `/letters/${id}`);

export const patchLetter = (id: number, content: string, version: number) =>
  request<Letter>("PATCH", `/letters/${id}`, { content, version });

export const listLetterVersions = (id: number) =>
  request<LetterVersionList>("GET", `/letters/${id}/versions`);
