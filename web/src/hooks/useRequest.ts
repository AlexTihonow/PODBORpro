import { useCallback, useEffect, useState } from "react";

interface RequestState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Простая загрузка данных вместо библиотеки запросов:
 * запускает load() при изменении key, отдаёт data/error/loading и reload().
 */
export function useRequest<T>(load: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<RequestState<T>>({ data: null, error: null, loading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    load()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          });
        }
      });
    return () => {
      active = false;
    };
    // load стабилен (модульная функция api-слоя), поэтому его нет в зависимостях.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data: state.data, error: state.error, loading: state.loading, reload };
}
