import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import type { FeedItem } from "@/api/types";
import { getVacancy } from "@/api/vacancies";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";
import {
  formatSalary,
  gradeLabel,
  scorePercent,
  sourceLabel,
  workFormatLabel,
} from "@/lib/format";

import { ScoreBreakdown } from "./ScoreBreakdown";

export function VacancyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const preview = usePreviewState();

  const feedItem = (location.state as { feedItem?: FeedItem } | null)?.feedItem;
  const vacancyId = Number(id);

  const vacancyQuery = useQuery({
    queryKey: ["vacancy", vacancyId],
    queryFn: () => getVacancy(vacancyId),
    enabled: Number.isFinite(vacancyId),
  });

  if (preview === "loading") return <VacancySkeleton />;

  if (preview === "error" || vacancyQuery.isError) {
    return (
      <ErrorState
        title="Вакансия не найдена"
        message="Возможно, она была удалена или ссылка устарела."
      />
    );
  }

  if (vacancyQuery.isLoading || !vacancyQuery.data) return <VacancySkeleton />;

  const vacancy = vacancyQuery.data;

  return (
    <div className="space-y-4">
      <Link to="/feed" className="inline-block text-sm text-ink-muted hover:text-ink">
        ← К ленте
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink">{vacancy.title}</h1>
            <p className="mt-1 text-ink-muted">{vacancy.company}</p>
          </div>
          {feedItem && (
            <Badge tone="brand" className="shrink-0">
              {scorePercent(feedItem.score)}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="font-medium text-ink">{formatSalary(vacancy)}</span>
          {vacancy.city && <span>{vacancy.city}</span>}
          {vacancy.work_format && <span>{workFormatLabel(vacancy.work_format)}</span>}
          {vacancy.grade && <span>{gradeLabel(vacancy.grade)}</span>}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {vacancy.skills.map((skill) => (
            <Chip key={skill.id}>{skill.name}</Chip>
          ))}
        </div>

        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {vacancy.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          {vacancy.url && (
            <a
              href={vacancy.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Открыть на {sourceLabel(vacancy.source)}
            </a>
          )}
          {vacancy.also_on.map((copy) => (
            <a
              key={copy.source}
              href={copy.url}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted hover:text-ink"
            >
              {sourceLabel(copy.source)}
            </a>
          ))}
        </div>

        <div className="mt-6 border-t border-edge pt-5">
          {/* Настоящее составление письма придёт в К-8; пока ведём на макет редактора. */}
          <Button onClick={() => navigate("/letters/15")}>Составить письмо</Button>
        </div>
      </Card>

      {feedItem && <ScoreBreakdown explanation={feedItem.explanation} />}
    </div>
  );
}

function VacancySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-20" />
      <Card className="space-y-4 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
      </Card>
    </div>
  );
}
