import { useSearchParams } from "react-router-dom";

/**
 * Состояние для показа макетов (К-2): загрузка / пусто / ошибка,
 * плюс «подбор упрощён» для ленты. Включается параметром `?preview=...`
 * и задокументировано на служебной странице /dev/components.
 */
export type PreviewState = "loading" | "empty" | "error" | "simplified" | null;

const VALID: ReadonlySet<string> = new Set(["loading", "empty", "error", "simplified"]);

export function usePreviewState(): PreviewState {
  const [searchParams] = useSearchParams();
  const value = searchParams.get("preview");
  return value && VALID.has(value) ? (value as PreviewState) : null;
}
