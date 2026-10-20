import { getFeed } from "../api.js";
import { getPathname, navigate, withBase } from "../router.js";
import { mountShell } from "../shell.js";
import {
  alert,
  chip,
  companyTone,
  emptyState,
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
  scoreTone,
  skeletonLine,
  workFormatLabel,
} from "../ui.js";

export async function renderFeedPage(isCurrent) {
  const preview = previewState();
  const main = mountShell("feed", `${hero(null)}${feedSkeleton()}`);
  bindRetry(main);

  if (preview === "loading") return;

  if (preview === "empty") {
    main.innerHTML = `${hero(null)}${emptyState({
      title: "Подходящих вакансий пока нет",
      description: "Попробуйте изменить желаемую должность или добавить навыки в настройках.",
      action: `<a class="btn btn--primary btn--md" href="${withBase("/onboarding")}" data-link data-to="/onboarding">Настроить подбор</a>`,
    })}`;
    return;
  }

  if (preview === "error") {
    main.innerHTML = `${hero(null)}${errorState({
      title: "Не получилось загрузить ленту",
      message: "Проверьте подключение к интернету и попробуйте ещё раз.",
    })}`;
    bindRetry(main);
    return;
  }

  let feed;
  try {
    feed = await getFeed();
  } catch (error) {
    if (!isCurrent()) return;
    main.innerHTML = `${hero(null)}${errorState({
      title: "Не получилось загрузить ленту",
      message: error.message,
    })}`;
    bindRetry(main);
    return;
  }

  if (!isCurrent()) return;

  const simplified = preview === "simplified" || Boolean(feed.simplified);
  const items = feed.items ?? [];

  if (items.length === 0) {
    main.innerHTML = `${hero(feed)}${emptyState({
      title: "Подходящих вакансий пока нет",
      description: "Попробуйте изменить желаемую должность или добавить навыки в настройках.",
      action: `<a class="btn btn--primary btn--md" href="${withBase("/onboarding")}" data-link data-to="/onboarding">Настроить подбор</a>`,
    })}`;
    return;
  }

  main.innerHTML = `
    ${hero(feed)}
    ${simplified ? alert("warning", "Подбор упрощён: сервис подбора временно недоступен, поэтому вакансии подобраны только по навыкам и фильтрам — без смысловой близости.") : ""}
    <div class="feed-grid">
      ${items.map((item, index) => vacancyCard(item, index)).join("")}
    </div>
  `;
}

function hero(feed) {
  const items = feed?.items ?? [];
  const best = items.reduce((max, item) => Math.max(max, item.score ?? 0), 0);
  const strong = items.filter((item) => item.score >= 0.7).length;

  return `<section class="page-hero">
    <div class="page-hero__text">
      <span class="eyebrow">${icon("sparkles")} Персональная подборка</span>
      <h1 class="page-title">Вакансии для вас</h1>
      <p class="page-subtitle">Собрали варианты по навыкам, уровню и условиям. Совпадение считаем по вашему профилю.</p>
    </div>
    <div class="page-hero__aside">
      <div class="hero-stats">
        <div class="hero-stat">
          <strong>${feed ? items.length : "—"}</strong>
          <span>вакансий</span>
        </div>
        <div class="hero-stat">
          <strong>${feed ? strong : "—"}</strong>
          <span>сильных совпадений</span>
        </div>
        <div class="hero-stat">
          <strong>${feed ? scorePercent(best) : "—"}</strong>
          <span>лучший матч</span>
        </div>
      </div>
    </div>
  </section>`;
}

function vacancyCard(item, index) {
  const { vacancy, score, explanation } = item;
  const tone = scoreTone(score);

  return `<article class="card vacancy-card" style="--i:${index}">
    <div class="vacancy-card__top">
      <div class="company-logo ${companyTone(vacancy.company)}">${esc(initial(vacancy.company))}</div>
      <div class="vacancy-card__heading">
        <h2 class="vacancy-card__title line-clamp-2">
          <a href="${withBase(`/vacancies/${vacancy.id}`)}" data-link data-to="/vacancies/${vacancy.id}">${esc(vacancy.title)}</a>
        </h2>
        <p class="vacancy-card__company">${esc(vacancy.company)}${vacancy.city ? ` <span class="dot"></span> ${esc(vacancy.city)}` : ""}</p>
      </div>
      ${scoreRing(score)}
    </div>

    <div class="vacancy-card__meta">
      ${metaItem("briefcase", formatSalary(vacancy), "meta-item--strong")}
      ${vacancy.work_format ? metaItem("clock", workFormatLabel(vacancy.work_format)) : ""}
      ${vacancy.grade ? metaItem("star", gradeLabel(vacancy.grade)) : ""}
    </div>

    <div class="vacancy-card__skills">
      ${vacancy.skills.slice(0, 5).map((skill) => chip(skill.name)).join("")}
    </div>

    <div class="vacancy-card__notes">
      ${
        explanation.matched_skills.length > 0
          ? `<span class="note note--match">${icon("check")} Совпало: ${esc(explanation.matched_skills.join(", "))}</span>`
          : ""
      }
      ${
        explanation.missing_skills.length > 0
          ? `<span class="note note--missing">${icon("x")} Не хватает: ${esc(explanation.missing_skills.join(", "))}</span>`
          : ""
      }
    </div>

    <a class="vacancy-card__cta vacancy-card__cta--${tone}" href="${withBase(`/vacancies/${vacancy.id}`)}" data-link data-to="/vacancies/${vacancy.id}">
      <span>Подробнее</span>${icon("arrow")}
    </a>
  </article>`;
}

function feedSkeleton() {
  return `<div class="feed-grid">
    ${Array.from({ length: 6 })
      .map(
        () => `<article class="card vacancy-card vacancy-card--skeleton">
          <div class="vacancy-card__top">
            <span class="skeleton skeleton--avatar"></span>
            <div class="vacancy-card__heading" style="flex:1">
              ${skeletonLine("72%", 18, "margin-bottom:8px")}
              ${skeletonLine("40%", 14)}
            </div>
          </div>
          <div style="margin-top:20px">${skeletonLine("100%", 14, "margin-bottom:10px")}${skeletonLine("65%", 14)}</div>
          <div class="vacancy-card__skills" style="margin-top:18px">
            ${skeletonLine("54px", 24)}${skeletonLine("72px", 24)}${skeletonLine("96px", 24)}
          </div>
          <div style="margin-top:22px">${skeletonLine("100%", 38)}</div>
        </article>`,
      )
      .join("")}
  </div>`;
}

function bindRetry(main) {
  main.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => navigate(`${getPathname()}${location.search}`));
  });
}
