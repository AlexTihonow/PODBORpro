import { listApplications } from "@/api/applications";
import type { ApplicationStatus } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";
import { useRequest } from "@/hooks/useRequest";
import { applicationStatusLabel, formatDate } from "@/lib/format";

const COLUMNS: ApplicationStatus[] = ["draft", "sent", "interview", "offer", "rejected"];

export function ApplicationsPage() {
  const preview = usePreviewState();
  const { data, error, loading, reload } = useRequest(() => listApplications(), "applications");

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
        onRetry={reload}
      />
    );
  }

  if (loading) return <BoardSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Не получилось загрузить отклики"
        message={error.message}
        onRetry={reload}
      />
    );
  }

  const applications = data?.items ?? [];

  return (
    <div className="feed">
      <h1 className="page-title">Доска откликов</h1>

      {applications.length === 0 ? (
        <EmptyState
          title="Откликов пока нет"
          description="Откройте подходящую вакансию и составьте первое письмо."
        />
      ) : (
        <div className="board">
          {COLUMNS.map((status) => {
            const items = applications.filter((application) => application.status === status);
            return (
              <div key={status} className="board-column">
                <div className="board-column__header">
                  <span className="board-column__title">{applicationStatusLabel(status)}</span>
                  <Badge tone="neutral">{items.length}</Badge>
                </div>
                <div className="board-column__body">
                  {items.map((application) => (
                    <Card key={application.id} className="app-card">
                      <p className="app-card__title line-clamp-2">{application.vacancy.title}</p>
                      <p className="app-card__company">{application.vacancy.company}</p>
                      <p className="app-card__date">Обновлено {formatDate(application.updated_at)}</p>
                    </Card>
                  ))}
                  {items.length === 0 && <div className="board-empty">Нет откликов</div>}
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
    <div className="board">
      {COLUMNS.map((status) => (
        <div key={status} className="board-column">
          <Skeleton style={{ height: 24, width: "100%" }} />
          <Skeleton style={{ height: 96, width: "100%", marginTop: 12 }} />
          <Skeleton style={{ height: 96, width: "100%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
