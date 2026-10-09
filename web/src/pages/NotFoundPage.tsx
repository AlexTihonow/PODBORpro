import { Link } from "@/components/Link";

export function NotFoundPage() {
  return (
    <div className="not-found">
      <p className="not-found__code">404</p>
      <p className="not-found__text">Такой страницы нет.</p>
      <Link to="/">На главную</Link>
    </div>
  );
}
