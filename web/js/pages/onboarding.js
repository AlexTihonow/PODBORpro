import { patchMe } from "../api.js";
import { navigate } from "../router.js";
import { setProfile } from "../session.js";
import { mountShell } from "../shell.js";
import { alert, esc, icon } from "../ui.js";

const STEPS = ["Резюме", "Навыки", "Должность и условия"];
const SAMPLE_SKILLS = ["Go", "PostgreSQL", "Docker", "Kubernetes", "Python", "gRPC", "Git", "Redis"];

const WORK_FORMATS = [
  { value: "office", label: "Офис" },
  { value: "remote", label: "Удалённо" },
  { value: "hybrid", label: "Гибрид" },
];

export function renderOnboardingPage() {
  const main = mountShell("onboarding", "");

  const state = {
    step: 0,
    fileName: "",
    skills: new Set(["Go", "PostgreSQL", "Docker"]),
    targetTitle: "Разработчик на Go",
    grade: "junior",
    cities: "Москва",
    salaryFrom: "120000",
    workFormats: new Set(["remote"]),
    tone: "neutral",
    error: "",
  };

  function draw() {
    main.innerHTML = `<div class="onboarding page-enter">
      <header class="onboarding__header">
        <span class="eyebrow">${icon("settings")} Первичная настройка</span>
        <h1 class="page-title">Настроим подбор под вас</h1>
        <p class="page-subtitle">Три коротких шага — и лента станет заметно точнее.</p>
      </header>
      ${stepIndicator(state.step)}
      <section class="card onboarding-card">
        ${state.error ? alert("error", state.error) : ""}
        ${state.step === 0 ? resumeStep() : state.step === 1 ? skillsStep() : preferencesStep()}
      </section>
    </div>`;
    bind();
  }

  function stepIndicator(current) {
    return `<ol class="steps">
      ${STEPS.map(
        (label, index) => `<li class="step ${index === current ? "step--active" : ""} ${index < current ? "step--done" : ""}">
          <span class="step__num">${index < current ? icon("check") : index + 1}</span>
          <span class="step__label">${label}</span>
          ${index < STEPS.length - 1 ? `<span class="step-line${index < current ? " step-line--done" : ""}"></span>` : ""}
        </li>`,
      ).join("")}
    </ol>`;
  }

  function resumeStep() {
    return `<div class="onboarding-step">
      <div class="onboarding-step__intro">
        <span class="onboarding-step__icon">${icon("file")}</span>
        <div>
          <h2 class="onboarding-step__title">Загрузите резюме</h2>
          <p class="onboarding-step__text">PDF или DOCX, до 10 МБ. Мы разберём навыки и проекты автоматически.</p>
        </div>
      </div>

      <label class="upload-drop">
        <input type="file" accept=".pdf,.docx" data-file />
        <span class="upload-drop__icon">${icon("upload")}</span>
        <span class="upload-drop__name">${state.fileName ? esc(state.fileName) : "Выберите файл резюме"}</span>
        <span class="upload-drop__hint">Перетащите файл сюда или нажмите, чтобы выбрать</span>
      </label>

      <div class="form-actions">
        <span class="field__hint">Сначала загрузите резюме — данные можно будет проверить на следующем шаге</span>
        <button class="btn btn--primary btn--md" type="button" data-next ${state.fileName ? "" : "disabled"}>Продолжить ${icon("arrow")}</button>
      </div>
    </div>`;
  }

  function skillsStep() {
    return `<div class="onboarding-step">
      <div class="onboarding-step__intro">
        <span class="onboarding-step__icon onboarding-step__icon--violet">${icon("sparkles")}</span>
        <div>
          <h2 class="onboarding-step__title">Подтвердите навыки</h2>
          <p class="onboarding-step__text">Мы нашли их в резюме. Снимите лишнее — от этого зависит точность подбора.</p>
        </div>
      </div>

      <div class="toggle-list">
        ${SAMPLE_SKILLS.map(
          (skill) => `<button class="toggle${state.skills.has(skill) ? " toggle--on" : ""}" type="button" data-skill="${esc(skill)}">
            ${state.skills.has(skill) ? icon("check") : icon("plus")} ${esc(skill)}
          </button>`,
        ).join("")}
      </div>

      <div class="form-actions">
        <button class="btn btn--secondary btn--md" type="button" data-back>${icon("back")} Назад</button>
        <button class="btn btn--primary btn--md" type="button" data-next>Продолжить ${icon("arrow")}</button>
      </div>
    </div>`;
  }

  function preferencesStep() {
    return `<div class="onboarding-step">
      <div class="onboarding-step__intro">
        <span class="onboarding-step__icon onboarding-step__icon--green">${icon("briefcase")}</span>
        <div>
          <h2 class="onboarding-step__title">Должность и условия</h2>
          <p class="onboarding-step__text">По ним мы будем искать подходящие вакансии.</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="field__label" for="onb-title">Желаемая должность <span class="field__required">*</span></label>
          <input class="input" id="onb-title" data-field="targetTitle" value="${esc(state.targetTitle)}" />
        </div>
        <div class="field">
          <label class="field__label" for="onb-grade">Уровень</label>
          <select class="select" id="onb-grade" data-field="grade">
            <option value="junior" ${state.grade === "junior" ? "selected" : ""}>Джуниор</option>
            <option value="middle" ${state.grade === "middle" ? "selected" : ""}>Мидл</option>
            <option value="senior" ${state.grade === "senior" ? "selected" : ""}>Сеньор</option>
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="onb-cities">Города</label>
          <input class="input" id="onb-cities" data-field="cities" value="${esc(state.cities)}" placeholder="Москва, Санкт-Петербург" />
        </div>
        <div class="field">
          <label class="field__label" for="onb-salary">Зарплата от, ₽</label>
          <input class="input" id="onb-salary" type="number" min="0" data-field="salaryFrom" value="${esc(state.salaryFrom)}" />
        </div>
      </div>

      <div class="field">
        <span class="field__label">Формат работы</span>
        <div class="toggle-list">
          ${WORK_FORMATS.map(
            (format) => `<button class="toggle${state.workFormats.has(format.value) ? " toggle--on" : ""}" type="button" data-format="${format.value}">
              ${state.workFormats.has(format.value) ? icon("check") : icon("plus")} ${format.label}
            </button>`,
          ).join("")}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="onb-tone">Тон писем</label>
        <select class="select" id="onb-tone" data-field="tone">
          <option value="formal" ${state.tone === "formal" ? "selected" : ""}>Формальный</option>
          <option value="neutral" ${state.tone === "neutral" ? "selected" : ""}>Нейтральный</option>
          <option value="friendly" ${state.tone === "friendly" ? "selected" : ""}>Дружелюбный</option>
        </select>
      </div>

      <div class="form-actions">
        <button class="btn btn--secondary btn--md" type="button" data-back>${icon("back")} Назад</button>
        <button class="btn btn--primary btn--md" type="button" data-finish>${icon("check")} Готово</button>
      </div>
    </div>`;
  }

  function bind() {
    const fileInput = main.querySelector("[data-file]");
    fileInput?.addEventListener("change", () => {
      state.fileName = fileInput.files?.[0]?.name ?? "";
      draw();
    });

    main.querySelector("[data-next]")?.addEventListener("click", () => {
      if (state.step === 0 && !state.fileName) return;
      state.step = Math.min(2, state.step + 1);
      draw();
    });

    main.querySelector("[data-back]")?.addEventListener("click", () => {
      state.step = Math.max(0, state.step - 1);
      draw();
    });

    main.querySelectorAll("[data-skill]").forEach((button) => {
      button.addEventListener("click", () => {
        const skill = button.dataset.skill;
        if (state.skills.has(skill)) state.skills.delete(skill);
        else state.skills.add(skill);
        draw();
      });
    });

    main.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => {
        const format = button.dataset.format;
        if (state.workFormats.has(format)) state.workFormats.delete(format);
        else state.workFormats.add(format);
        draw();
      });
    });

    main.querySelectorAll("[data-field]").forEach((field) => {
      field.addEventListener("input", () => {
        state[field.dataset.field] = field.value;
      });
      field.addEventListener("change", () => {
        state[field.dataset.field] = field.value;
      });
    });

    main.querySelector("[data-finish]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!state.targetTitle.trim()) {
        state.error = "Укажите желаемую должность";
        draw();
        return;
      }

      button.disabled = true;
      const profile = {
        target_title: state.targetTitle.trim(),
        target_grade: state.grade,
        cities: state.cities
          .split(",")
          .map((city) => city.trim())
          .filter(Boolean),
        work_formats: [...state.workFormats],
        salary_from: Number(state.salaryFrom) || null,
        tone: state.tone,
        resume_status: "ready",
        skills: [...state.skills].map((name, index) => ({ id: 100 + index, name })),
      };

      try {
        await patchMe(profile);
      } catch {}
      setProfile(profile);
      navigate("/feed");
    });
  }

  draw();
}
