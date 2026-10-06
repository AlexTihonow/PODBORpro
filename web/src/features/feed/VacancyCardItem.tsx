import { Link } from "react-router-dom";

import type { FeedItem } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import {
  formatSalary,
  gradeLabel,
  scorePercent,
  scoreTone,
  workFormatLabel,
} from "@/lib/format";

export function VacancyCardItem({ item }: { item: FeedItem }) {
  const { vacancy, score, explanation } = item;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`/vacancies/${vacancy.id}`}
            state={{ feedItem: item }}
            className="line-clamp-2 text-base font-semibold text-ink hover:text-brand-700"
          >
            {vacancy.title}
          </Link>
          <p className="mt-0.5 text-sm text-ink-muted">{vacancy.company}</p>
        </div>
        <Badge tone={scoreTone(score)} className="shrink-0">
          {scorePercent(score)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="font-medium text-ink">{formatSalary(vacancy)}</span>
        {vacancy.city && <span>· {vacancy.city}</span>}
        {vacancy.work_format && <span>· {workFormatLabel(vacancy.work_format)}</span>}
        {vacancy.grade && <span>· {gradeLabel(vacancy.grade)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {vacancy.skills.map((skill) => (
          <Chip key={skill.id}>{skill.name}</Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {explanation.matched_skills.length > 0 && (
          <span className="text-success">Совпало: {explanation.matched_skills.join(", ")}</span>
        )}
        {explanation.missing_skills.length > 0 && (
          <span className="text-warning">Не хватает: {explanation.missing_skills.join(", ")}</span>
        )}
      </div>
    </Card>
  );
}
