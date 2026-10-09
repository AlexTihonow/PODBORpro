/**
 * Хранение токена доступа. Отделено от store, чтобы api/client мог читать токен
 * без циклической зависимости. Очистка токена (например, при 401) уведомляет
 * подписчиков — auth store реагирует и перерисовывает защищённые маршруты.
 */
const ACCESS_TOKEN_KEY = "podbor.access_token";

const clearedListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  for (const listener of clearedListeners) listener();
}

export function onAccessTokenCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}
