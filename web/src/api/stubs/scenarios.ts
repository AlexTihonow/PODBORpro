import { stubMap } from "./manifest";
import type { StubCall, StubResult } from "./types";

/**
 * Заглушки-сценарии для адресов, где ответ зависит от входных данных.
 * Данные по-прежнему берутся из примеров openapi.yaml (manifest.ts);
 * здесь только выбирается нужный статус и подставляются введённые значения,
 * чтобы демонстрация входа/регистрации выглядела правдоподобно.
 *
 * Демо-триггеры:
 *   - вход с почтой wrong@mail.ru -> 401 «Неверная почта или пароль»;
 *   - регистрация с почтой taken@mail.ru -> 409 «Почта уже занята».
 */
interface CredentialsBody {
  email?: string;
  password?: string;
  full_name?: string;
}

export function applyScenario(call: StubCall & { operationId: string }): StubResult | null {
  switch (call.operationId) {
    case "login": {
      const body = call.body as CredentialsBody;
      const email = (body.email ?? "").trim().toLowerCase();
      if (email === "wrong@mail.ru") {
        return { status: 401, data: stubMap.login["401"] };
      }
      return {
        status: 200,
        data: {
          ...stubMap.login["200"],
          user: { ...stubMap.login["200"].user, email },
        },
      };
    }

    case "register": {
      const body = call.body as CredentialsBody;
      const email = (body.email ?? "").trim().toLowerCase();
      const fullName = (body.full_name ?? "").trim() || "Иван Петров";
      if (email === "taken@mail.ru") {
        return { status: 409, data: stubMap.register["409"] };
      }
      return {
        status: 201,
        data: {
          ...stubMap.register["201"],
          user: { ...stubMap.register["201"].user, email, full_name: fullName },
        },
      };
    }

    default:
      return null;
  }
}
