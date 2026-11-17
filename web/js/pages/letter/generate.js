import { generateCoverLetter, getCoverLetterPrompt, getVacancy } from "../../api/index.js";
import { getPathname, navigate, withBase } from "../../core/router.js";
import { mountShell } from "../../ui/shell.js";
import { alert, errorState, esc, icon, previewState, skeletonLine, spinner } from "../../ui/components.js";

// Страница /vacancies/:id/letter — письмо, которое сервер составляет через
// языковую модель (POST /vacancies/{id}/cover-letter). Письмо не сохраняется:
// его можно поправить и скопировать.
export async function renderCoverLetterPage(vacancyId, isCurrent) {
  const preview = previewState();
  const main = mountShell("feed", skeleton(vacancyId));
  if (preview === "loading") return;

  // Заголовок — по возможности с названием вакансии; без него страница тоже работает.
  const vacancyPromise = getVacancy(vacancyId)
    .then((vacancy) => (vacancy?.id === vacancyId ? vacancy : null))
    .catch(() => null);

  let result;
  try {
    if (preview === "error") throw Object.assign(new Error("Сервис писем недоступен"), { status: 503 });
    result = await generateCoverLetter(vacancyId);
  } catch (error) {
    if (!isCurrent()) return;
    main.innerHTML = `${backLink(vacancyId)}${errorState({ title: "Не удалось составить письмо", message: errorMessage(error) })}${
      canUsePrompt(error) ? promptFallback() : ""
    }`;
    bindRetry(main);
    bindPromptFallback(main, vacancyId);
    return;
  }
  const vacancy = await vacancyPromise;
  if (!isCurrent()) return;

  main.innerHTML = `
    ${backLink(vacancyId)}
    <div class="editor">
      <section class="card editor-card">
        <div class="editor-card__header">
          <div>
            <span class="eyebrow">${icon("sparkles")} Сопроводительное письмо</span>
            <h1 class="editor-card__title">${vacancy ? esc(vacancy.title) : "Письмо к вакансии"}</h1>
            ${vacancy?.company ? `<p class="editor-card__subtitle">${esc(vacancy.company)}</p>` : ""}
          </div>
          <span class="version-badge" data-badge></span>
        </div>

        <p class="editor-hint">${icon("info")} Проверьте письмо перед отправкой: модель может ошибаться. Всё, что не про вас, — удалите.</p>

        <div data-banner></div>

        <textarea class="textarea editor-textarea editor-textarea--letter" aria-label="Текст письма" data-textarea></textarea>

        <div class="editor-status" data-status></div>

        <div class="editor-actions">
          <span class="editor-count" data-count></span>
          <div class="editor-actions__buttons">
            <button class="btn btn--secondary btn--md" type="button" data-regenerate>${icon("refresh")}<span>Составить заново</span></button>
            <button class="btn btn--primary btn--md" type="button" data-copy>${icon("file")}<span>Скопировать</span></button>
          </div>
        </div>
      </section>

      <aside class="card editor-aside">
        <div class="section-heading">
          <h2 class="editor-aside__title">Как составлено</h2>
          ${icon("info", "editor-aside__icon")}
        </div>
        <ul class="letter-facts">
          <li>Письмо составляет языковая модель GLM-4.7-Flash (Z.AI) по вашему профилю и тексту вакансии.</li>
          <li>Модели передаются желаемая должность, уровень, навыки, города и формат работы. Имя, почта и контакты — нет.</li>
          <li>Письмо не сохраняется: скопируйте его, прежде чем уйти со страницы.</li>
        </ul>
      </aside>
    </div>
  `;

  const textarea = main.querySelector("[data-textarea]");
  const status = main.querySelector("[data-status]");
  const count = main.querySelector("[data-count]");
  const badge = main.querySelector("[data-badge]");
  const banner = main.querySelector("[data-banner]");
  const regenerate = main.querySelector("[data-regenerate]");
  const copy = main.querySelector("[data-copy]");

  function show(next) {
    textarea.value = next.cover_letter ?? "";
    badge.textContent = next.demo ? "Демо-черновик" : "Черновик";
    banner.innerHTML = next.offline
      ? alert("warning", "Сервер недоступен — показан демо-черновик без языковой модели.")
      : next.demo
        ? alert("info", "Демо-режим: черновик собран в браузере без языковой модели.")
        : "";
    refreshCount();
  }

  function refreshCount() {
    count.textContent = `${textarea.value.trim().length} символов`;
  }

  textarea.addEventListener("input", () => {
    textarea.dataset.edited = "1";
    status.innerHTML = "";
    refreshCount();
  });

  regenerate.addEventListener("click", async () => {
    if (textarea.dataset.edited === "1" && !confirm("Составить письмо заново? Ваши правки пропадут.")) return;
    regenerate.disabled = true;
    copy.disabled = true;
    regenerate.innerHTML = `${spinner()}<span>Составляем…</span>`;
    status.innerHTML = "";
    try {
      const next = await generateCoverLetter(vacancyId);
      if (!isCurrent()) return;
      show(next);
      delete textarea.dataset.edited;
    } catch (error) {
      if (!isCurrent()) return;
      status.innerHTML = alert("error", errorMessage(error)) + (canUsePrompt(error) ? promptFallback() : "");
      bindPromptFallback(status, vacancyId);
    } finally {
      regenerate.disabled = false;
      copy.disabled = false;
      regenerate.innerHTML = `${icon("refresh")}<span>Составить заново</span>`;
    }
  });

  copy.addEventListener("click", async () => {
    const ok = await copyText(textarea.value, textarea);
    status.innerHTML = ok
      ? alert("success", "Письмо скопировано")
      : alert("error", "Не удалось скопировать — выделите текст и скопируйте вручную");
  });

  show(result);
}

function errorMessage(error) {
  switch (error?.status) {
    case 404:
      return "Вакансия не найдена — возможно, её уже сняли с публикации.";
    case 429:
      return error.message || "Слишком много писем подряд, попробуйте позже.";
    case 503:
      return "Составление писем сейчас выключено на сервере. Попробуйте позже.";
    case 502:
    case 504:
      return error.message || "Модель не ответила, попробуйте ещё раз.";
    default:
      return error?.message || "Что-то пошло не так, попробуйте ещё раз.";
  }
}

// Промт нужен, когда модель недоступна; при 404/401 он тоже не соберётся.
function canUsePrompt(error) {
  return error?.status !== 404 && error?.status !== 401 && error?.status !== 400;
}

function promptFallback() {
  return `<section class="card prompt-fallback" data-prompt-fallback>
    <div class="prompt-fallback__text">
      <h2 class="prompt-fallback__title">${icon("sparkles")} Составьте письмо в другой нейросети</h2>
      <p>Скопируйте готовый промт — в нём правила, ваш профиль и вакансия — и вставьте его в ChatGPT, GigaChat, DeepSeek или любой другой чат.</p>
    </div>
    <button class="btn btn--primary btn--md" type="button" data-copy-prompt disabled>${spinner()}<span>Готовим промт…</span></button>
    <div class="prompt-fallback__status" data-prompt-status></div>
    <textarea class="textarea prompt-fallback__textarea" readonly hidden aria-label="Промт для нейросети" data-prompt-text></textarea>
  </section>`;
}

// Промт загружается сразу, чтобы копирование шло прямо по нажатию
// (иначе браузер может не дать доступ к буферу обмена).
async function bindPromptFallback(root, vacancyId) {
  const box = root.querySelector("[data-prompt-fallback]");
  if (!box) return;
  const button = box.querySelector("[data-copy-prompt]");
  const status = box.querySelector("[data-prompt-status]");
  const text = box.querySelector("[data-prompt-text]");
  const label = `${icon("file")}<span>Скопировать промт</span>`;
  try {
    text.value = (await getCoverLetterPrompt(vacancyId)).prompt ?? "";
  } catch (error) {
    button.innerHTML = label;
    status.innerHTML = alert("error", error.message || "Не удалось подготовить промт");
    return;
  }
  button.disabled = false;
  button.innerHTML = label;
  button.addEventListener("click", async () => {
    const ok = await copyText(text.value, text);
    text.hidden = ok;
    status.innerHTML = ok
      ? alert("success", "Промт скопирован — вставьте его в чат нейросети")
      : alert("warning", "Не удалось скопировать автоматически — выделите текст ниже и скопируйте вручную");
  });
}

async function copyText(value, field) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    field.hidden = false;
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

function backLink(vacancyId) {
  const to = `/vacancies/${vacancyId}`;
  return `<a class="back-link" href="${withBase(to)}" data-link data-to="${to}">${icon("back")} К вакансии</a>`;
}

function skeleton(vacancyId) {
  return `${backLink(vacancyId)}
  <div class="editor">
    <section class="card editor-card">
      <p class="editor-generating">${spinner()} Составляем письмо — обычно это занимает до минуты…</p>
      ${skeletonLine("40%", 24, "margin:18px 0 20px")}
      ${skeletonLine("100%", 220, "margin-bottom:18px")}
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
