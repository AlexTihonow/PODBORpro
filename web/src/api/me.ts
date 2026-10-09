import { request } from "./client";
import type { components } from "./schema";
import type { Me } from "./types";

export const getMe = () => request<Me>("GET", "/me");

export const patchMe = (body: components["schemas"]["PatchMeRequest"]) =>
  request<Me>("PATCH", "/me", body);
