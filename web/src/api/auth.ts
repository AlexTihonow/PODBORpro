import { request } from "./client";
import type { components } from "./schema";

export const login = (email: string, password: string) =>
  request<components["schemas"]["TokenResponse"]>("POST", "/auth/login", { email, password });

export const register = (body: components["schemas"]["RegisterRequest"]) =>
  request<components["schemas"]["TokenResponse"]>("POST", "/auth/register", body);
