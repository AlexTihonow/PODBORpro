import type { FeedItem } from "@/api/types";
import { getVacancy } from "@/api/vacancies";
import { Link } from "@/components/Link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreviewState } from "@/hooks/usePreviewState";
import { useRequest } from "@/hooks/useRequest";
import {
  formatSalary,
  gradeLabel,
  scorePercent,
  sourceLabel,
  workFormatLabel,
} from "@/lib/format";
import { getNavState, navigate } from "@/router";

import { ScoreBreakdown } from "./ScoreBreakdown";

export function VacancyPage({ id }: { id: number }) {
  const preview = usePreviewState();
  const feedItem = (getNavState() as { feedItem?: FeedItem } | null)?.feedItem;

  const { data: vacancy, error, loading } = useRequest(() => getVacancy(id), id);

  if (preview === "loading") return <VacancySkeleton />;

  if (preview === "error" || error) {
    return (
      <ErrorState
        title="Вакансия не найдена"
        message="Возможно, она была удалена или ссылка устарела."
      />
    );
  }

  if (loading || !vacancy) return <VacancySkeleton />;

  return (
    <div className="vacancy">
      <Link to="/feed" className="vacancy-back">
        ← К ленте
      </Link>

      <Card className="vacancy-detail">
        <div className="vacancy-detail__head">
          <div>
            <h1 className="vacancy-detail__title">{vacancy.title}</h1>
            <p className="vacancy-detail__company">{vacancy.company}</p>
          </div>
          {feedItem && <Badge tone="brand">{scorePercent(feedItem.score)}</Badge>}
        </div>

        <div className="vacancy-detail__meta">
          <span className="vacancy-detail__salary">{formatSalary(vacancy)}</span>
          {vacancy.city && <span>{vacancy.city}</span>}
          {vacancy.work_format && <span>{workFormatLabel(vacancy.work_format)}</span>}
          {vacancy.grade && <span>{gradeLabel(vacancy.grade)}</span>}
        </div>

        <div className="vacancy-detail__skills">
          {vacancy.skills.map((skill) => (
            <Chip key={skill.id}>{skill.name}</Chip>
          ))}
        </div>

        <p className="vacancy-detail__desc">{vacancy.description}</p>

        <div className="vacancy-detail__links">
          {vacancy.url && (
            <a href={vacancy.url} target="_blank" rel="noreferrer">
              Открыть на {sourceLabel(vacancy.source)}
            </a>
          )}
          {vacancy.also_on.map((copy) => (
            <a key={copy.source} href={copy.url} target="_blank" rel="noreferrer">
              {sourceLabel(copy.source)}
            </a>
          ))}
        </div>

        <div className="vacancy-detail__actions">
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
    <div className="vacancy">
      <Skeleton style={{ height: 16, width: 80 }} />
      <Card className="vacancy-detail">
        <Skeleton style={{ height: 24, width: "60%" }} />
        <Skeleton style={{ height: 16, width: "25%", marginTop: 8 }} />
        <div className="vacancy-detail__skills">
          <Skeleton style={{ height: 24, width: 56 }} />
          <Skeleton style={{ height: 24, width: 72 }} />
          <Skeleton style={{ height: 24, width: 96 }} />
        </div>
        <Skeleton style={{ height: 128, width: "100%", marginTop: 20 }} />
      </Card>
    </div>
  );
}
