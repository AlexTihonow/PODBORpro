import { clearAccessToken, getAccessToken } from "@/lib/token";

import { resolveStub, waitForStub } from "./stubs";
import type { StubCall } from "./stubs/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
// Пока С-2 не готов, работаем на заглушках. `VITE_USE_STUBS=false` включает настоящие запросы.
const USE_STUBS = import.meta.env.VITE_USE_STUBS !== "false";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  signal?: AbortSignal;
  /** false — не добавлять заголовок Authorization (например, /health). */
  auth?: boolean;
}

export async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  if (USE_STUBS) {
    return requestViaStub<T>(method, path, body);
  }
  return requestViaHttp<T>(method, path, body, options);
}

async function requestViaStub<T>(method: HttpMethod, path: string, body: unknown): Promise<T> {
  await waitForStub();

  const [pathname, queryString = ""] = path.split("?");
  const call: StubCall = {
    method,
    path: pathname,
    query: new URLSearchParams(queryString),
    body: body ?? null,
  };

  const result = resolveStub(call);
  if (!result) {
    throw new ApiError(404, "not_found", "Не найдено");
  }

  if (result.status >= 400) {
    const payload = result.data as { error?: { code?: string; message?: string } } | null;
    if (result.status === 401) clearAccessToken();
    throw new ApiError(
      result.status,
      payload?.error?.code ?? "error",
      payload?.error?.message ?? "Ошибка запроса",
    );
  }

  if (result.status === 204) return undefined as T;
  return result.data as T;
}

async function requestViaHttp<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const token = getAccessToken();
  if (token && options.auth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "network",
      "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.",
    );
  }

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Тело — не JSON; оставляем null.
  }

  if (!response.ok) {
    const payload = data as { error?: { code?: string; message?: string } } | null;
    if (response.status === 401) clearAccessToken();
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? `Ошибка ${response.status}`,
    );
  }

  return data as T;
}
