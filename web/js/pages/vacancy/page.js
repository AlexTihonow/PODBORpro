import { createLetter, getCachedFeedItem, getVacancy } from "../../api/index.js";
import { getPathname, navigate, withBase } from "../../core/router.js";
import { mountShell } from "../../ui/shell.js";
import {
  companyTone,
  errorState,
  esc,
  formatSalary,
  gradeLabel,
  icon,
  initial,
  metaItem,
  previewState,
  scoreRing,
  skeletonLine,
  sourceLabel,
  workFormatLabel,
} from "../../ui/components.js";
import { scoreBreakdown } from "./breakdown.js";
import { mlInsights } from "./insights.js";

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
    ${mlInsights(vacancy)}
  `;

  bindLetterButton(main, vacancy.id);
}

function bindLetterButton(main, vacancyId) {
  const button = main.querySelector("[data-letter]");
  button?.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const letter = await createLetter(vacancyId);
      navigate(`/letters/${letter.id}`);
    } catch {
      button.disabled = false;
    }
  });
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
