import { badge, esc, scorePercent } from "../../ui/components.js";

const GRADE_FIT_LABELS = {
  match: "Уровень совпадает с желаемым",
  lower: "Вакансия ниже желаемого уровня",
  higher: "Вакансия выше желаемого уровня",
  unknown: "Уровень не определён",
};

const PART_LABELS = [
  { key: "similarity", label: "Близость по должности" },
  { key: "skills", label: "Навыки" },
  { key: "grade", label: "Уровень" },
  { key: "freshness", label: "Свежесть" },
];

export function scoreBreakdown(item) {
  const { explanation, score } = item;

  return `<section class="card score-breakdown">
    <div class="section-heading">
      <div>
        <h2 class="card-title">Почему такая оценка</h2>
        <p class="section-heading__hint">${esc(GRADE_FIT_LABELS[explanation.grade_fit] ?? "Уровень не определён")}</p>
      </div>
      ${badge(`Совпадение ${scorePercent(score)}`, "brand")}
    </div>

    <div class="score-breakdown__grid">
      <div class="score-breakdown__block">
        <p class="score-breakdown__label">Совпало</p>
        <div class="score-breakdown__tags">
          ${
            explanation.matched_skills.length === 0
              ? `<span class="field__hint">Ничего</span>`
              : explanation.matched_skills.map((skill) => badge(skill, "success")).join("")
          }
        </div>
      </div>
      <div class="score-breakdown__block">
        <p class="score-breakdown__label">Не хватает</p>
        <div class="score-breakdown__tags">
          ${
            explanation.missing_skills.length === 0
              ? `<span class="field__hint">Всё на месте</span>`
              : explanation.missing_skills.map((skill) => badge(skill, "warning")).join("")
          }
        </div>
      </div>
    </div>

    <div class="score-parts">
      ${PART_LABELS.map((part) => {
        const value = explanation.parts[part.key];
        const percent = value == null ? 0 : Math.round(value * 100);
        return `<div class="score-part">
          <div class="score-part__row">
            <span class="score-part__label">${part.label}</span>
            <span class="score-part__value">${value == null ? "—" : `${percent}%`}</span>
          </div>
          <div class="score-bar"><span class="score-bar__fill" style="width:${percent}%"></span></div>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}
