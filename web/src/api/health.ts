import { request } from "./client";
import type { Health } from "./types";

export const getHealth = () => request<Health>("GET", "/health", undefined, { auth: false });
