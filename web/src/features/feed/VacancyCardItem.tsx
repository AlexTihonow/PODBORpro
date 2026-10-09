import type { FeedItem } from "@/api/types";
import { Link } from "@/components/Link";
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
    <Card className="vacancy-card">
      <div className="vacancy-card__top">
        <div>
          <Link
            to={`/vacancies/${vacancy.id}`}
            state={{ feedItem: item }}
            className="vacancy-card__title line-clamp-2"
          >
            {vacancy.title}
          </Link>
          <p className="vacancy-card__company">{vacancy.company}</p>
        </div>
        <Badge tone={scoreTone(score)}>{scorePercent(score)}</Badge>
      </div>

      <div className="vacancy-card__meta">
        <span className="vacancy-card__salary">{formatSalary(vacancy)}</span>
        {vacancy.city && <span>· {vacancy.city}</span>}
        {vacancy.work_format && <span>· {workFormatLabel(vacancy.work_format)}</span>}
        {vacancy.grade && <span>· {gradeLabel(vacancy.grade)}</span>}
      </div>

      <div className="vacancy-card__skills">
        {vacancy.skills.map((skill) => (
          <Chip key={skill.id}>{skill.name}</Chip>
        ))}
      </div>

      <div className="vacancy-card__notes">
        {explanation.matched_skills.length > 0 && (
          <span className="note--match">Совпало: {explanation.matched_skills.join(", ")}</span>
        )}
        {explanation.missing_skills.length > 0 && (
          <span className="note--missing">Не хватает: {explanation.missing_skills.join(", ")}</span>
        )}
      </div>
    </Card>
  );
}
