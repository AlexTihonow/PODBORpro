import { useQuery } from "@tanstack/react-query";

import { listApplications } from "@/api/applications";
import type { ApplicationStatus } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";
import { applicationStatusLabel, formatDate } from "@/lib/format";

const COLUMNS: ApplicationStatus[] = ["draft", "sent", "interview", "offer", "rejected"];

export function ApplicationsPage() {
  const preview = usePreviewState();
  const applicationsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });

  if (preview === "loading") return <BoardSkeleton />;

  if (preview === "empty") {
    return (
      <EmptyState
        title="Откликов пока нет"
        description="Откройте подходящую вакансию и составьте первое письмо."
      />
    );
  }

  if (preview === "error") {
    return (
      <ErrorState
        title="Не получилось загрузить отклики"
        message="Проверьте подключение к интернету и попробуйте ещё раз."
        onRetry={() => applicationsQuery.refetch()}
      />
    );
  }

  if (applicationsQuery.isLoading) return <BoardSkeleton />;

  if (applicationsQuery.isError) {
    return (
      <ErrorState
        title="Не получилось загрузить отклики"
        message={applicationsQuery.error?.message ?? "Не получилось загрузить отклики"}
        onRetry={() => applicationsQuery.refetch()}
      />
    );
  }

  const applications = applicationsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Доска откликов</h1>

      {applications.length === 0 ? (
        <EmptyState
          title="Откликов пока нет"
          description="Откройте подходящую вакансию и составьте первое письмо."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          {COLUMNS.map((status) => {
            const items = applications.filter((application) => application.status === status);
            return (
              <div key={status} className="rounded-xl border border-edge bg-surface p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">
                    {applicationStatusLabel(status)}
                  </span>
                  <Badge tone="neutral">{items.length}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {items.map((application) => (
                    <Card key={application.id} className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-ink">
                        {application.vacancy.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {application.vacancy.company}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Обновлено {formatDate(application.updated_at)}
                      </p>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-edge px-3 py-4 text-center text-xs text-ink-subtle">
                      Нет откликов
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {COLUMNS.map((status) => (
        <div key={status} className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
