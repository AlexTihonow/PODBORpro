import { getLetter, listLetterVersions, patchLetter } from "../api.js";
import { getPathname, navigate } from "../router.js";
import { mountShell } from "../shell.js";
import {
  alert,
  errorState,
  esc,
  formatDate,
  icon,
  previewState,
  skeletonLine,
  spinner,
} from "../ui.js";

export async function renderLetterPage(id, isCurrent) {
  const preview = previewState();
  const main = mountShell("feed", editorSkeleton());
  bindRetry(main);

  if (preview === "loading") return;

  if (preview === "error") {
    main.innerHTML = errorState({
      title: "Письмо не найдено",
      message: "Возможно, ссылка устарела.",
    });
    bindRetry(main);
    return;
  }

  let letter;
  let versions;
  try {
    [letter, versions] = await Promise.all([getLetter(id), listLetterVersions(id)]);
  } catch (error) {
    if (!isCurrent()) return;
    main.innerHTML = errorState({
      title: "Письмо не найдено",
      message: error.status === 404 ? "Возможно, ссылка устарела." : error.message,
    });
    bindRetry(main);
    return;
  }

  if (!isCurrent()) return;

  let currentLetter = letter;
  let currentVersions = versions.items ?? [];
  let fragments = letter.unverified ?? [];

  main.innerHTML = `
    <div class="editor">
      <section class="card editor-card">
        <div class="editor-card__header">
          <div>
            <span class="eyebrow">${icon("file")} Сопроводительное письмо</span>
            <h1 class="editor-card__title">Письмо к вакансии</h1>
          </div>
          <span class="version-badge" data-version>Версия ${letter.version}</span>
        </div>

        <p class="editor-hint">${icon("info")} Жёлтым выделены утверждения, которых нет в портфолио, — проверьте их перед отправкой.</p>

        <div class="letter-preview" data-preview></div>

        <textarea class="textarea editor-textarea" aria-label="Текст письма" data-textarea>${esc(letter.content)}</textarea>

        <div class="editor-status" data-status></div>

        <div class="editor-actions">
          <span class="editor-count" data-count></span>
          <button class="btn btn--primary btn--md" type="button" data-save>${icon("save")}<span>Сохранить</span></button>
        </div>
      </section>

      <aside class="card editor-aside">
        <div class="section-heading">
          <h2 class="editor-aside__title">История версий</h2>
          ${icon("clock", "editor-aside__icon")}
        </div>
        <ul class="version-list" data-versions></ul>
      </aside>
    </div>
  `;

  const textarea = main.querySelector("[data-textarea]");
  const previewBox = main.querySelector("[data-preview]");
  const status = main.querySelector("[data-status]");
  const count = main.querySelector("[data-count]");
  const versionLabel = main.querySelector("[data-version]");
  const versionsList = main.querySelector("[data-versions]");
  const saveButton = main.querySelector("[data-save]");

  function refreshPreview() {
    previewBox.innerHTML = highlight(textarea.value, fragments);
    count.textContent = `${textarea.value.trim().length} символов`;
  }

  function refreshVersions() {
    versionsList.innerHTML = renderVersions(currentVersions);
  }

  textarea.addEventListener("input", () => {
    status.innerHTML = "";
    refreshPreview();
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.innerHTML = `${spinner()}<span>Сохраняем…</span>`;
    status.innerHTML = "";

    try {
      currentLetter = await patchLetter(currentLetter.id, textarea.value, currentLetter.version);
      fragments = currentLetter.unverified ?? [];
      currentVersions = (await listLetterVersions(currentLetter.id)).items ?? [];
      versionLabel.textContent = `Версия ${currentLetter.version}`;
      refreshPreview();
      refreshVersions();
      status.innerHTML = alert("success", "Сохранено");
    } catch (error) {
      status.innerHTML = alert("error", error.message || "Не удалось сохранить письмо");
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = `${icon("save")}<span>Сохранить</span>`;
    }
  });

  refreshPreview();
  refreshVersions();
}

function renderVersions(versions) {
  if (versions.length === 0) return `<li class="version-empty">Версий пока нет</li>`;

  return versions
    .map(
      (version) => `<li class="version-item">
        <div class="version-item__row">
          <span class="version-item__num">Версия ${version.version}</span>
          <span class="version-item__author">${version.author === "model" ? "Модель" : "Вы"}</span>
        </div>
        <p class="version-item__date">${esc(formatDate(version.created_at))}</p>
      </li>`,
    )
    .join("");
}

function highlight(content, fragments) {
  const ranges = buildRanges(content, fragments);
  let cursor = 0;
  let html = "";

  for (const range of ranges) {
    if (range.start > cursor) html += esc(content.slice(cursor, range.start));
    html += `<mark>${esc(content.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  html += esc(content.slice(cursor));
  return html;
}

function buildRanges(content, fragments) {
  const ranges = [];

  for (const fragment of fragments) {
    if (fragment.start >= 0 && fragment.end <= content.length && fragment.start < fragment.end) {
      ranges.push({ start: fragment.start, end: fragment.end });
    } else {
      const found = content.indexOf(fragment.text);
      if (found >= 0) ranges.push({ start: found, end: found + fragment.text.length });
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function editorSkeleton() {
  return `<div class="editor">
    <section class="card editor-card">
      ${skeletonLine("40%", 24, "margin-bottom:20px")}
      ${skeletonLine("100%", 150, "margin-bottom:18px")}
      ${skeletonLine("100%", 40)}
    </section>
    <aside class="card editor-aside">
      ${skeletonLine("64px", 16, "margin-bottom:14px")}
      ${skeletonLine("100%", 64, "margin-bottom:8px")}
      ${skeletonLine("100%", 64)}
    </aside>
  </div>`;
}

function bindRetry(main) {
  main.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => navigate(`${getPathname()}${location.search}`));
  });
}
