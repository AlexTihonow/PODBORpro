import { getCachedFeedItem, getVacancy } from "../api.js";
import { getPathname, navigate, withBase } from "../router.js";
import { mountShell } from "../shell.js";
import {
  badge,
  companyTone,
  errorState,
  esc,
  formatSalary,
  gradeLabel,
  icon,
  initial,
  metaItem,
  previewState,
  scorePercent,
  scoreRing,
  skeletonLine,
  sourceLabel,
  workFormatLabel,
} from "../ui.js";

const GRADE_FIT_LABELS = {
  match: "Уровень совпадает с желаемым",
  lower: "Вакансия ниже желаемого уровня",
  higher: "Вакансия выше желаемого уровня",
  unknown: "Уровень не определён",
};

const PART_LABELS = [
  { key: "similarity", label: "Смысловая близость" },
  { key: "skills", label: "Навыки" },
  { key: "grade", label: "Уровень" },
  { key: "freshness", label: "Свежесть" },
];

export async function renderVacancyPage(id, isCurrent) {
  const preview = previewState();
  const main = mountShell("feed", skeleton());
  bindRetry(main);

  if (preview === "loading") return;

  if (preview === "error") {
    main.innerHTML = errorState({
      title: "Вакансия не найдена",
      message: "Возможно, она была удалена или ссылка устарела.",
    });
    bindRetry(main);
    return;
  }

  let vacancy;
  try {
    vacancy = await getVacancy(id);
  } catch (error) {
    if (!isCurrent()) return;
    main.innerHTML = errorState({
      title: "Вакансия не найдена",
      message: error.status === 404 ? "Возможно, она была удалена или ссылка устарела." : error.message,
    });
    bindRetry(main);
    return;
  }

  if (!isCurrent()) return;

  const feedItem = getCachedFeedItem(id);

  main.innerHTML = `
    <a class="back-link" href="${withBase("/feed")}" data-link data-to="/feed">${icon("back")} К ленте</a>

    <section class="card vacancy-detail">
      <div class="vacancy-detail__head">
        <div class="company-logo company-logo--lg ${companyTone(vacancy.company)}">${esc(initial(vacancy.company))}</div>
        <div class="vacancy-detail__heading">
          <h1 class="vacancy-detail__title">${esc(vacancy.title)}</h1>
          <p class="vacancy-detail__company">${esc(vacancy.company)}</p>
        </div>
        ${feedItem ? scoreRing(feedItem.score, "lg") : ""}
      </div>

      <div class="vacancy-detail__meta">
        ${metaItem("briefcase", formatSalary(vacancy), "meta-item--strong")}
        ${vacancy.city ? metaItem("location", vacancy.city) : ""}
        ${vacancy.work_format ? metaItem("clock", workFormatLabel(vacancy.work_format)) : ""}
        ${vacancy.grade ? metaItem("star", gradeLabel(vacancy.grade)) : ""}
      </div>

      <div class="vacancy-detail__skills">
        ${vacancy.skills.map((skill) => `<span class="chip">${esc(skill.name)}</span>`).join("")}
      </div>

      <p class="vacancy-detail__desc">${esc(vacancy.description)}</p>

      <div class="vacancy-detail__links">
        ${vacancy.url ? `<a class="source-link" href="${esc(vacancy.url)}" target="_blank" rel="noreferrer">${icon("external")} Открыть на ${esc(sourceLabel(vacancy.source))}</a>` : ""}
        ${(vacancy.also_on ?? []).map((copy) => `<a class="source-link" href="${esc(copy.url)}" target="_blank" rel="noreferrer">${icon("external")} ${esc(sourceLabel(copy.source))}</a>`).join("")}
      </div>

      <div class="vacancy-detail__actions">
        <button class="btn btn--primary btn--lg" type="button" data-letter>${icon("edit")}<span>Составить письмо</span></button>
        <span class="vacancy-detail__hint">Письмо можно проверить и отредактировать перед отправкой</span>
      </div>
    </section>

    ${feedItem ? scoreBreakdown(feedItem) : ""}
  `;

  main.querySelector("[data-letter]")?.addEventListener("click", () => navigate("/letters/15"));
}

function scoreBreakdown(item) {
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

function skeleton() {
  return `<div class="vacancy">
    ${skeletonLine("84px", 16, "margin-bottom:20px")}
    <div class="card vacancy-detail">
      <div class="vacancy-detail__head">
        <span class="skeleton skeleton--avatar skeleton--avatar-lg"></span>
        <div class="vacancy-detail__heading" style="flex:1">
          ${skeletonLine("55%", 24, "margin-bottom:10px")}
          ${skeletonLine("28%", 16)}
        </div>
      </div>
      <div style="margin-top:24px">${skeletonLine("100%", 16, "margin-bottom:10px")}${skeletonLine("72%", 16)}</div>
      <div class="vacancy-detail__skills" style="margin-top:22px">
        ${skeletonLine("60px", 26)}${skeletonLine("88px", 26)}${skeletonLine("70px", 26)}
      </div>
      <div style="margin-top:28px">${skeletonLine("100%", 14, "margin-bottom:10px")}${skeletonLine("96%", 14, "margin-bottom:10px")}${skeletonLine("84%", 14)}</div>
    </div>
  </div>`;
}

function bindRetry(main) {
  main.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => navigate(`${getPathname()}${location.search}`));
  });
}
