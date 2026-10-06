import type { ScoreExplanation, ScoreParts } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const GRADE_FIT_LABELS: Record<ScoreExplanation["grade_fit"], string> = {
  match: "Уровень совпадает с желаемым",
  lower: "Вакансия ниже желаемого уровня",
  higher: "Вакансия выше желаемого уровня",
  unknown: "Уровень не определён",
};

const PART_LABELS: Array<{ key: keyof ScoreParts; label: string }> = [
  { key: "similarity", label: "Смысловая близость" },
  { key: "skills", label: "Навыки" },
  { key: "grade", label: "Уровень" },
  { key: "freshness", label: "Свежесть" },
];

export function ScoreBreakdown({ explanation }: { explanation: ScoreExplanation }) {
  return (
    <Card className="score-breakdown">
      <h2 className="card-title">Почему такая оценка</h2>

      <p className="score-breakdown__label" style={{ marginTop: 8 }}>
        {GRADE_FIT_LABELS[explanation.grade_fit]}
      </p>

      <div className="score-breakdown__grid">
        <div>
          <p className="score-breakdown__label">Совпало</p>
          <div className="score-breakdown__tags">
            {explanation.matched_skills.length === 0 ? (
              <span className="field__hint">Ничего</span>
            ) : (
              explanation.matched_skills.map((skill) => (
                <Badge key={skill} tone="success">
                  {skill}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="score-breakdown__label">Не хватает</p>
          <div className="score-breakdown__tags">
            {explanation.missing_skills.length === 0 ? (
              <span className="field__hint">Всё на месте</span>
            ) : (
              explanation.missing_skills.map((skill) => (
                <Badge key={skill} tone="warning">
                  {skill}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="score-parts">
        {PART_LABELS.map((part) => {
          const value = explanation.parts[part.key];
          return (
            <div key={part.key}>
              <div className="score-part__row">
                <span className="score-part__label">{part.label}</span>
                <span>{value == null ? "—" : `${Math.round(value * 100)}%`}</span>
              </div>
              <div className="score-bar">
                <div className="score-bar__fill" style={{ width: `${(value ?? 0) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
