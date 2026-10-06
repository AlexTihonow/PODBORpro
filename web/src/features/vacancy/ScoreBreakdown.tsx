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
    <Card className="p-6">
      <h2 className="text-base font-semibold text-ink">Почему такая оценка</h2>

      <p className="mt-2 text-sm text-ink-muted">{GRADE_FIT_LABELS[explanation.grade_fit]}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-ink">Совпало</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {explanation.matched_skills.length === 0 ? (
              <span className="text-sm text-ink-subtle">Ничего</span>
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
          <p className="text-sm font-medium text-ink">Не хватает</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {explanation.missing_skills.length === 0 ? (
              <span className="text-sm text-ink-subtle">Всё на месте</span>
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

      <div className="mt-5 space-y-3">
        {PART_LABELS.map((part) => {
          const value = explanation.parts[part.key];
          return (
            <div key={part.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{part.label}</span>
                <span className="text-ink">{value == null ? "—" : `${Math.round(value * 100)}%`}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(value ?? 0) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
