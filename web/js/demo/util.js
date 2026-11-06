import { CONFIG } from "../api/config.js";

export function clone(value) {
  return structuredClone(value);
}

export function delay() {
  return new Promise((resolve) => setTimeout(resolve, CONFIG.stubDelay));
}

export function nowIso() {
  return new Date().toISOString();
}
