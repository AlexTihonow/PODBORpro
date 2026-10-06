import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl font-bold text-ink">404</p>
      <p className="text-ink-muted">Такой страницы нет.</p>
      <Link to="/" className="font-medium text-brand-600 hover:text-brand-700">
        На главную
      </Link>
    </div>
  );
}
