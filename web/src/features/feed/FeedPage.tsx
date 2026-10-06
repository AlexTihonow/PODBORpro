import { useQuery } from "@tanstack/react-query";

import { getFeed } from "@/api/feed";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";

import { VacancyCardItem } from "./VacancyCardItem";

export function FeedPage() {
  const preview = usePreviewState();
  const feedQuery = useQuery({ queryKey: ["feed"], queryFn: () => getFeed() });

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
        onRetry={() => feedQuery.refetch()}
      />
    );
  }

  if (feedQuery.isLoading) return <FeedSkeleton />;

  if (feedQuery.isError) {
    return (
      <ErrorState
        title="Не получилось загрузить ленту"
        message={feedQuery.error?.message ?? "Не получилось загрузить ленту"}
        onRetry={() => feedQuery.refetch()}
      />
    );
  }

  const feed = feedQuery.data;
  const simplified = preview === "simplified" || Boolean(feed?.simplified);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Лента</h1>

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
        <div className="grid gap-4 md:grid-cols-2">
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
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="space-y-3 p-5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}
