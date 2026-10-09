import { getFeed } from "@/api/feed";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";
import { useRequest } from "@/hooks/useRequest";

import { VacancyCardItem } from "./VacancyCardItem";

export function FeedPage() {
  const preview = usePreviewState();
  const { data: feed, error, loading, reload } = useRequest(() => getFeed(), "feed");

  if (preview === "loading") return <FeedSkeleton />;

  if (preview === "empty") {
    return (
      <EmptyState
        title="Подходящих вакансий пока нет"
        description="Попробуйте убрать часть фильтров или изменить желаемую должность."
      />
    );
  }

  if (preview === "error") {
    return (
      <ErrorState
        title="Не получилось загрузить ленту"
        message="Проверьте подключение к интернету и попробуйте ещё раз."
        onRetry={reload}
      />
    );
  }

  if (loading) return <FeedSkeleton />;

  if (error) {
    return (
      <ErrorState title="Не получилось загрузить ленту" message={error.message} onRetry={reload} />
    );
  }

  const simplified = preview === "simplified" || Boolean(feed?.simplified);

  return (
    <div className="feed">
      <h1 className="page-title">Лента</h1>

      {simplified && (
        <Alert tone="warning">
          Подбор упрощён: сервис подбора временно недоступен, поэтому вакансии подобраны
          только по навыкам и фильтрам — без смысловой близости.
        </Alert>
      )}

      {feed && feed.items.length === 0 ? (
        <EmptyState
          title="Подходящих вакансий пока нет"
          description="Попробуйте убрать часть фильтров или изменить желаемую должность."
        />
      ) : (
        <div className="feed-grid">
          {feed?.items.map((item) => (
            <VacancyCardItem key={item.vacancy.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="feed-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="vacancy-card">
          <Skeleton style={{ height: 20, width: "75%" }} />
          <Skeleton style={{ height: 16, width: "33%", marginTop: 8 }} />
          <Skeleton style={{ height: 16, width: "100%", marginTop: 12 }} />
          <div className="vacancy-card__skills">
            <Skeleton style={{ height: 24, width: 56 }} />
            <Skeleton style={{ height: 24, width: 72 }} />
            <Skeleton style={{ height: 24, width: 96 }} />
          </div>
        </Card>
      ))}
    </div>
  );
}
