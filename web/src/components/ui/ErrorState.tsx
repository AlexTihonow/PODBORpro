import { cn } from "@/lib/cn";

import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Что-то пошло не так",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("error-state", className)}>
      <p className="error-state__title">{title}</p>
      {message && <p className="error-state__desc">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="error-state__retry">
          Попробовать ещё раз
        </Button>
      )}
    </div>
  );
}
