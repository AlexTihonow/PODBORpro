import { ApiError, getMe } from "../../api/index.js";
import { setAccessToken, setProfile, setStoredUser } from "../../core/session.js";
import { alert, esc, icon, logo, spinner } from "../../ui/components.js";

export function authLayout({ title, subtitle, form, footer }) {
  return `<div class="auth-page">
    <div class="auth-shell">
      <aside class="auth-brand">
        <div class="auth-brand__glow auth-brand__glow--one"></div>
        <div class="auth-brand__glow auth-brand__glow--two"></div>
        ${logo({ light: true })}
        <div class="auth-brand__content">
          <span class="eyebrow eyebrow--light">${icon("sparkles")} Умный поиск работы</span>
          <h2 class="auth-brand__title">Работа, которая подходит именно вам</h2>
          <p class="auth-brand__text">Персональная лента, понятный разбор совпадений и письма, которые приятно отправлять.</p>
          <ul class="auth-features">
            <li>${icon("check")} Подбор по навыкам, уровню и условиям</li>
            <li>${icon("check")} Проверка фактов в сопроводительном письме</li>
            <li>${icon("check")} Одна доска для всех откликов</li>
          </ul>
        </div>
        <p class="auth-brand__foot">ПОДБОРпро · демонстрационная версия</p>
      </aside>

      <section class="auth-card">
        <div class="auth-card__logo">${logo()}</div>
        <div class="auth-card__head">
          <h1 class="auth-title">${esc(title)}</h1>
          <p class="auth-subtitle">${esc(subtitle)}</p>
        </div>
        ${form}
        <p class="auth-footer">${footer}</p>
      </section>
    </div>
  </div>`;
}

export function textField({ id, name, type, label, iconName, autocomplete, placeholder, value = "", testId, extra = "" }) {
  return `<label class="field" for="${id}">
    <span class="field__label">${esc(label)} <span class="field__required">*</span></span>
    <span class="input-wrap">
      ${icon(iconName, "input-wrap__icon")}
      <input class="input input--icon" id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" placeholder="${esc(placeholder)}" value="${esc(value)}" data-testid="${testId}" />
    </span>
    <span class="field__error" data-error="${name}"></span>
    ${extra}
  </label>`;
}

export function passwordField({ id, autocomplete, testId }) {
  return `<label class="field" for="${id}">
    <span class="field__label">Пароль <span class="field__required">*</span></span>
    <span class="input-wrap">
      ${icon("lock", "input-wrap__icon")}
      <input class="input input--icon input--password" id="${id}" name="password" type="password" autocomplete="${autocomplete}" placeholder="От 8 символов" data-testid="${testId}" />
      <button class="input-wrap__action" type="button" data-toggle-password aria-label="Показать пароль">${icon("eye")}</button>
    </span>
    <span class="field__error" data-error="password"></span>
  </label>`;
}

export function submitButton(label, testId) {
  return `<button class="btn btn--primary btn--lg btn--block" type="submit" data-testid="${testId}">
    <span>${esc(label)}</span>${icon("arrow")}
  </button>`;
}

export const validators = {
  email(value) {
    const email = value.trim();
    if (!email) return "Укажите почту";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Похоже, в почте опечатка";
    return null;
  },
  password(value) {
    if (!value) return "Укажите пароль";
    if (value.length < 8) return "Пароль должен быть не короче 8 символов";
    return null;
  },
  name(value) {
    return value.trim() ? null : "Укажите имя";
  },
};

export function bindField(root, name, validate) {
  const input = root.querySelector(`[name='${name}']`);
  const error = root.querySelector(`[data-error='${name}']`);
  const field = { input, touched: false, override: null };

  field.show = (message) => {
    input.classList.toggle("input--invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message ?? "";
  };
  field.check = () => {
    field.touched = true;
    const message = field.override ?? validate(input.value);
    field.show(message);
    return !message;
  };

  input.addEventListener("blur", field.check);
  input.addEventListener("input", () => {
    field.override = null;
    if (field.touched) field.show(validate(input.value));
  });
  return field;
}

export function checkAll(fields) {
  return fields.map((field) => field.check()).every(Boolean);
}

export function bindPasswordToggle(root) {
  const button = root.querySelector("[data-toggle-password]");
  const input = root.querySelector("[name='password']");
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.innerHTML = icon(visible ? "eye" : "eyeOff");
    button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
  });
}

export function apiErrorAlert(error, testId) {
  const attrs = `data-testid="${testId}"`;
  if (!(error instanceof ApiError)) return alert("error", "Что-то пошло не так. Попробуйте ещё раз.", attrs);
  if (error.code === "network") {
    return alert("error", "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.", attrs);
  }
  return alert("error", error.message, attrs);
}

export function setLoading(button, loading, label) {
  button.disabled = loading;
  button.innerHTML = loading ? `${spinner()}<span>${esc(label)}</span>` : `<span>${esc(label)}</span>${icon("arrow")}`;
}

export async function startSession(response) {
  setAccessToken(response.access_token);
  setStoredUser(response.user);
  try {
    const me = await getMe();
    setProfile(me.profile);
    return me.profile?.resume_status ?? null;
  } catch {
    return null;
  }
}
