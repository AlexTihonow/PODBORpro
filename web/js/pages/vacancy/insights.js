import { badge, esc, gradeLabel, scorePercent, workFormatLabel } from "../../ui/components.js";

const SOURCE_LABELS = { rule: "правило", laya: "Laya", source: "сайт" };

const LABELS = [
  { key: "grade", title: "Уровень", format: (value) => gradeLabel(value) },
  { key: "work_format", title: "Формат работы", format: (value) => workFormatLabel(value) },
  { key: "english", title: "Английский", format: (value) => (value ? "требуется" : "не требуется") },
];

export function mlInsights(vacancy) {
  const tags = vacancy.tags ?? [];
  const labels = vacancy.labels ?? {};
  const rows = LABELS.filter((item) => labels[item.key]);
  if (tags.length === 0 && rows.length === 0) return "";

  return `<section class="card score-breakdown">
    <div class="section-heading">
      <div>
        <h2 class="card-title">Разметка модели</h2>
        <p class="section-heading__hint">Laya multilingual: направление, уровень и условия</p>
      </div>
      ${vacancy.needs_review ? badge("Нужна проверка", "warning") : badge("Уверенно", "success")}
    </div>

    <div class="score-breakdown__tags">
      ${tags.map((tag) => badge(`${tag.label} · ${scorePercent(tag.confidence)}`, "brand")).join("")}
    </div>

    <div class="score-parts">
      ${rows.map((item) => labelRow(item, labels[item.key])).join("")}
    </div>
  </section>`;
}

function labelRow(item, label) {
  const percent = Math.round((label.confidence ?? 0) * 100);
  const source = SOURCE_LABELS[label.source] ?? label.source ?? "";
  return `<div class="score-part">
    <div class="score-part__row">
      <span class="score-part__label">${esc(item.title)}: ${esc(item.format(label.value))}</span>
      <span class="score-part__value">${percent}%${source ? ` · ${esc(source)}` : ""}</span>
    </div>
    <div class="score-bar"><span class="score-bar__fill" style="width:${percent}%"></span></div>
  </div>`;
}
