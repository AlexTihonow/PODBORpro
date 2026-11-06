import { listSkillNames, patchMe, skillKey } from "../../api/index.js";
import { navigate } from "../../core/router.js";
import { getProfile, setProfile } from "../../core/session.js";
import { mountShell } from "../../ui/shell.js";
import { alert, esc, icon } from "../../ui/components.js";

const STEPS = ["Резюме", "Навыки", "Должность и условия"];
// Shown while the vacancy catalog loads, or if it cannot be loaded.
const FALLBACK_SKILLS = ["Go", "PostgreSQL", "Docker", "Kubernetes", "Python", "gRPC", "Git", "Redis"];
const POPULAR_SKILLS_SHOWN = 30;

const RESUME_EXTENSIONS = [".pdf", ".docx"];
const RESUME_MAX_BYTES = 10 * 1024 * 1024;

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
    file: null,
    skills: new Set(getProfile()?.skills?.map((skill) => skill.name) ?? ["Go", "PostgreSQL", "Docker"]),
    // Every skill found in the vacancy catalog, most frequent first.
    skillOptions: FALLBACK_SKILLS.map((name) => ({ name, count: 0 })),
    skillQuery: "",
    showAllSkills: false,
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

      <label class="upload-drop" data-drop>
        <input type="file" accept=".pdf,.docx" data-file />
        <span class="upload-drop__icon">${icon("upload")}</span>
        <span class="upload-drop__name">${state.fileName ? esc(state.fileName) : "Выберите файл резюме"}</span>
        <span class="upload-drop__hint">Перетащите файл сюда или нажмите, чтобы выбрать</span>
      </label>

      <div class="form-actions">
        <span class="field__hint">${state.fileName ? "Данные из резюме можно будет проверить на следующем шаге" : "Нет резюме под рукой? Пропустите шаг и отметьте навыки вручную"}</span>
        <div class="form-actions__buttons">
          ${state.fileName ? "" : `<button class="btn btn--ghost btn--md" type="button" data-skip>Пропустить</button>`}
          <button class="btn btn--primary btn--md" type="button" data-next ${state.fileName ? "" : "disabled"}>Продолжить ${icon("arrow")}</button>
        </div>
      </div>
    </div>`;
  }

  function skillsStep() {
    return `<div class="onboarding-step">
      <div class="onboarding-step__intro">
        <span class="onboarding-step__icon onboarding-step__icon--violet">${icon("sparkles")}</span>
        <div>
          <h2 class="onboarding-step__title">Подтвердите навыки</h2>
          <p class="onboarding-step__text">${state.fileName ? "Мы нашли их в резюме. Снимите лишнее — от этого зависит точность подбора." : "Отметьте, чем владеете, — от этого зависит точность подбора."}</p>
        </div>
      </div>

      <div class="skill-picker">
        <label class="skill-picker__search">
          ${icon("search")}
          <input class="input" type="search" data-skill-query value="${esc(state.skillQuery)}"
            placeholder="Найти навык или добавить свой — Enter" aria-label="Поиск навыка" />
        </label>
        <div class="toggle-list" data-skill-list>${skillToggles()}</div>
      </div>

      <div class="form-actions">
        <button class="btn btn--secondary btn--md" type="button" data-back>${icon("back")} Назад</button>
        <button class="btn btn--primary btn--md" type="button" data-next>Продолжить ${icon("arrow")}</button>
      </div>
    </div>`;
  }

  // Skills are compared by skillKey, so "Go" and "Golang" count as one skill.
  function visibleSkills() {
    const query = state.skillQuery.trim().toLowerCase();
    const options = state.skillOptions.map((option) => option.name);
    // Selected skills always stay visible; a selected synonym shows under its own spelling.
    const selected = [...state.skills];
    const selectedKeys = new Set(selected.map(skillKey));
    const all = [...selected, ...options.filter((name) => !selectedKeys.has(skillKey(name)))];
    if (query) {
      return { names: all.filter((name) => name.toLowerCase().includes(query)), total: all.length, hidden: 0 };
    }
    const limit = state.showAllSkills ? Infinity : POPULAR_SKILLS_SHOWN;
    const popular = options.slice(0, limit).map((name) => selected.find((skill) => skillKey(skill) === skillKey(name)) ?? name);
    const popularKeys = new Set(popular.map(skillKey));
    const extraSelected = selected.filter((name) => !popularKeys.has(skillKey(name)));
    const names = [...extraSelected, ...popular];
    return { names, total: all.length, hidden: Math.max(0, all.length - names.length) };
  }

  function skillToggles() {
    const { names, total, hidden } = visibleSkills();
    const query = state.skillQuery.trim();
    const toggles = names.map(
      (skill) => `<button class="toggle${state.skills.has(skill) ? " toggle--on" : ""}" type="button" data-skill="${esc(skill)}">
        ${state.skills.has(skill) ? icon("check") : icon("plus")} ${esc(skill)}
      </button>`,
    );
    if (query && !names.some((name) => skillKey(name) === skillKey(query))) {
      toggles.push(`<button class="toggle toggle--add" type="button" data-skill-add>${icon("plus")} Добавить «${esc(query)}»</button>`);
    }
    if (hidden > 0) {
      toggles.push(`<button class="btn btn--ghost btn--sm" type="button" data-skill-more>Показать все (${total})</button>`);
    } else if (state.showAllSkills && !query) {
      toggles.push(`<button class="btn btn--ghost btn--sm" type="button" data-skill-more>Свернуть</button>`);
    }
    return toggles.join("") || `<span class="field__hint">Ничего не нашлось</span>`;
  }

  // Re-render only the list so the search field keeps focus while typing.
  function drawSkillList() {
    const list = main.querySelector("[data-skill-list]");
    if (list) list.innerHTML = skillToggles();
  }

  function toggleSkill(name) {
    const existing = [...state.skills].find((skill) => skillKey(skill) === skillKey(name));
    if (existing) state.skills.delete(existing);
    else state.skills.add(name);
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
      const file = fileInput.files?.[0];
      if (file) pickFile(file);
    });

    main.querySelector("[data-skip]")?.addEventListener("click", () => {
      state.error = "";
      state.step = 1;
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

    main.querySelector("[data-skill-list]")?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.matches("[data-skill]")) toggleSkill(button.dataset.skill);
      else if (button.matches("[data-skill-add]")) addTypedSkill();
      else if (button.matches("[data-skill-more]")) state.showAllSkills = !state.showAllSkills;
      drawSkillList();
    });

    const skillQuery = main.querySelector("[data-skill-query]");
    skillQuery?.addEventListener("input", () => {
      state.skillQuery = skillQuery.value;
      drawSkillList();
    });
    skillQuery?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addTypedSkill();
      skillQuery.value = state.skillQuery;
      drawSkillList();
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
        resume_status: state.fileName ? "ready" : "none",
        skills: [...state.skills].map((name, index) => ({ id: 100 + index, name })),
      };

      try {
        await patchMe(profile);
      } catch {}
      setProfile(profile);
      navigate("/feed");
    });
  }

  // Drop handling lives on window: a file dropped anywhere on the page (not only
  // exactly on the dashed box) is accepted on the resume step, and the browser
  // never navigates away to its own PDF viewer.
  let dragDepth = 0;
  const setOver = (on) => main.querySelector("[data-drop]")?.classList.toggle("upload-drop--over", on);
  const onDragEnter = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    if (state.step === 0) setOver(true);
  };
  const onDragOver = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = state.step === 0 ? "copy" : "none";
  };
  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setOver(false);
  };
  const onDrop = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && state.step === 0) pickFile(file);
  };
  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);
  // Detach once the user leaves onboarding (the shell re-renders #root).
  const detach = () => {
    if (main.isConnected) return;
    window.removeEventListener("dragenter", onDragEnter);
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("dragleave", onDragLeave);
    window.removeEventListener("drop", onDrop);
    observer.disconnect();
  };
  const observer = new MutationObserver(detach);
  observer.observe(document.getElementById("root"), { childList: true });

  function addTypedSkill() {
    const name = state.skillQuery.trim().replace(/\s+/g, " ");
    if (!name) return;
    const known = state.skillOptions.find((option) => skillKey(option.name) === skillKey(name));
    const skill = known?.name ?? name;
    if (![...state.skills].some((item) => skillKey(item) === skillKey(skill))) state.skills.add(skill);
    state.skillQuery = "";
  }

  function pickFile(file) {
    const name = file.name.toLowerCase();
    if (!RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      state.error = "Поддерживаются только файлы PDF и DOCX";
    } else if (file.size > RESUME_MAX_BYTES) {
      state.error = "Файл больше 10 МБ";
    } else {
      state.error = "";
      state.file = file;
      state.fileName = file.name;
    }
    draw();
  }

  draw();

  listSkillNames()
    .then((options) => {
      if (options.length === 0) return;
      state.skillOptions = options;
      if (state.step === 1) drawSkillList();
    })
    .catch(() => {});
}

function hasFiles(event) {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.prototype.indexOf.call(types, "Files") !== -1 || (types.contains?.("Files") ?? false);
}
