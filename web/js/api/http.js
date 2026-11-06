import { clearAccessToken, getAccessToken } from "../core/session.js";
import { CONFIG } from "./config.js";
import { ApiError } from "./error.js";

export async function requestHttp(method, path, body, options = {}) {
  const headers = {};
  let payload;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const token = getAccessToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${CONFIG.apiBase}${path}`, { method, headers, body: payload, signal: options.signal });
  } catch {
    throw new ApiError(0, "network", "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.");
  }

  if (response.status === 204) return undefined;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401) clearAccessToken();
    throw new ApiError(response.status, error.code ?? "unknown", error.message ?? `Ошибка ${response.status}`);
  }
  return data;
}
