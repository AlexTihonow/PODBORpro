import { stubMap } from "./manifest";
import { stubRoutes } from "./routes";
import { applyScenario } from "./scenarios";
import type { StubCall, StubResult } from "./types";

/**
 * Слой заглушек: сопоставляет запрос (метод + путь) с operationId из
 * openapi.yaml и возвращает example-ответ нужного статуса. Данные — только из
 * примеров описания, поэтому заглушки клиента и сервера всегда одинаковы.
 */

// Небольшая задержка, чтобы состояния «загрузка» были видны в макетах.
const STUB_DELAY_MS = 400;

export async function waitForStub(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS));
}

export function resolveStub(call: StubCall): StubResult | null {
  const match = matchRoute(call.method, call.path);
  if (!match) return null;

  const scenario = applyScenario({
    ...call,
    operationId: match.operationId,
    pathParams: match.pathParams,
  });
  if (scenario) return scenario;

  const byStatus = stubMap[match.operationId as keyof typeof stubMap];
  if (!byStatus) {
    // 204 без тела (например, удаление проекта).
    return { status: 204, data: null };
  }

  const success = Object.keys(byStatus).find((status) => status.startsWith("2"));
  if (!success) {
    return { status: 500, data: { error: { code: "internal", message: "Внутренняя ошибка сервера" } } };
  }

  return { status: Number(success), data: byStatus[success as keyof typeof byStatus] };
}

function matchRoute(method: string, path: string) {
  for (const route of stubRoutes) {
    if (route.method !== method) continue;
    const pathParams = matchPath(route.path, path);
    if (pathParams) {
      return { operationId: route.operationId, pathParams };
    }
  }
  return null;
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    if (patternSegment.startsWith("{") && patternSegment.endsWith("}")) {
      params[patternSegment.slice(1, -1)] = decodeURIComponent(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}
