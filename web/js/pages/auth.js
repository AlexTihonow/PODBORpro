import { ApiError, getMe, login, register } from "../api.js";
import { navigate, withBase } from "../router.js";
import { mountPublic } from "../shell.js";
import { setAccessToken, setProfile, setStoredUser } from "../session.js";
import { alert, esc, icon, logo, spinner } from "../ui.js";

export function renderLoginPage() {
  const params = new URLSearchParams(location.search);
  const from = safeFrom(params.get("from"));
  const prefillEmail = params.get("email") ?? history.state?.email ?? "";

  const root = mountPublic(authLayout({
    title: "Вход",
    subtitle: "Войдите, чтобы увидеть персональную ленту вакансий.",
    form: `<form class="auth-form" data-form novalidate>
      <div data-form-error></div>

      <label class="field" for="login-email">
        <span class="field__label">Почта <span class="field__required">*</span></span>
        <span class="input-wrap">
          ${icon("mail", "input-wrap__icon")}
          <input class="input input--icon" id="login-email" name="email" type="email" autocomplete="email" placeholder="ivan@mail.ru" value="${esc(prefillEmail)}" data-testid="login-email" />
        </span>
        <span class="field__error" data-error="email"></span>
      </label>

      <label class="field" for="login-password">
        <span class="field__label">Пароль <span class="field__required">*</span></span>
        <span class="input-wrap">
          ${icon("lock", "input-wrap__icon")}
          <input class="input input--icon input--password" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="От 8 символов" data-testid="login-password" />
          <button class="input-wrap__action" type="button" data-toggle-password aria-label="Показать пароль">${icon("eye")}</button>
        </span>
        <span class="field__error" data-error="password"></span>
      </label>

      <button class="btn btn--primary btn--lg btn--block" type="submit" data-testid="login-submit">
        <span>Войти</span>${icon("arrow")}
      </button>
    </form>`,
    footer: `Нет аккаунта? <a href="${withBase("/register")}" data-link data-to="/register">Зарегистрироваться</a>`,
  }));

  const form = root.querySelector("[data-form]");
  const emailInput = root.querySelector("#login-email");
  const passwordInput = root.querySelector("#login-password");
  const submit = root.querySelector("[type='submit']");
  const formError = root.querySelector("[data-form-error]");
  const emailError = root.querySelector("[data-error='email']");
  const passwordError = root.querySelector("[data-error='password']");

  bindPasswordToggle(root, passwordInput);

  const touch = { email: false, password: false };

  emailInput.addEventListener("blur", () => {
    touch.email = true;
    setFieldError(emailInput, emailError, validateEmail(emailInput.value));
  });
  passwordInput.addEventListener("blur", () => {
    touch.password = true;
    setFieldError(passwordInput, passwordError, validatePassword(passwordInput.value));
  });

  emailInput.addEventListener("input", () => {
    if (touch.email) setFieldError(emailInput, emailError, validateEmail(emailInput.value));
  });
  passwordInput.addEventListener("input", () => {
    if (touch.password) setFieldError(passwordInput, passwordError, validatePassword(passwordInput.value));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.innerHTML = "";

    touch.email = true;
    touch.password = true;
    const nextEmailError = validateEmail(emailInput.value);
    const nextPasswordError = validatePassword(passwordInput.value);
    setFieldError(emailInput, emailError, nextEmailError);
    setFieldError(passwordInput, passwordError, nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setLoading(submit, true, "Входим…");

    try {
      const response = await login(emailInput.value.trim(), passwordInput.value);
      setAccessToken(response.access_token);
      setStoredUser(response.user);

      let resumeStatus = null;
      try {
        const me = await getMe();
        setProfile(me.profile);
        resumeStatus = me.profile?.resume_status ?? null;
      } catch {
        // Профиль подтянется в шапке после перехода.
      }

      navigate(resumeStatus === "none" ? "/onboarding" : from || "/feed");
    } catch (error) {
      formError.innerHTML = apiErrorAlert(error, "login-error");
      if (error instanceof ApiError && error.status === 401) {
        passwordInput.value = "";
        passwordInput.focus();
      }
      setLoading(submit, false, "Войти");
    }
  });
}

export function renderRegisterPage() {
  const root = mountPublic(authLayout({
    title: "Регистрация",
    subtitle: "Создайте аккаунт за минуту — без лишних вопросов.",
    form: `<form class="auth-form" data-form novalidate>
      <div data-form-error></div>

      <label class="field" for="register-email">
        <span class="field__label">Почта <span class="field__required">*</span></span>
        <span class="input-wrap">
          ${icon("mail", "input-wrap__icon")}
          <input class="input input--icon" id="register-email" name="email" type="email" autocomplete="email" placeholder="ivan@mail.ru" data-testid="register-email" />
        </span>
        <span class="field__error" data-error="email"></span>
        <span class="field__hint" data-email-link hidden></span>
      </label>

      <label class="field" for="register-name">
        <span class="field__label">Имя <span class="field__required">*</span></span>
        <span class="input-wrap">
          ${icon("user", "input-wrap__icon")}
          <input class="input input--icon" id="register-name" name="name" type="text" autocomplete="name" placeholder="Иван Петров" data-testid="register-name" />
        </span>
        <span class="field__error" data-error="name"></span>
      </label>

      <label class="field" for="register-password">
        <span class="field__label">Пароль <span class="field__required">*</span></span>
        <span class="input-wrap">
          ${icon("lock", "input-wrap__icon")}
          <input class="input input--icon input--password" id="register-password" name="password" type="password" autocomplete="new-password" placeholder="От 8 символов" data-testid="register-password" />
          <button class="input-wrap__action" type="button" data-toggle-password aria-label="Показать пароль">${icon("eye")}</button>
        </span>
        <span class="field__error" data-error="password"></span>
      </label>

      <button class="btn btn--primary btn--lg btn--block" type="submit" data-testid="register-submit">
        <span>Зарегистрироваться</span>${icon("arrow")}
      </button>
    </form>`,
    footer: `Уже есть аккаунт? <a href="${withBase("/login")}" data-link data-to="/login">Войти</a>`,
  }));

  const form = root.querySelector("[data-form]");
  const emailInput = root.querySelector("#register-email");
  const nameInput = root.querySelector("#register-name");
  const passwordInput = root.querySelector("#register-password");
  const submit = root.querySelector("[type='submit']");
  const formError = root.querySelector("[data-form-error]");
  const emailError = root.querySelector("[data-error='email']");
  const nameError = root.querySelector("[data-error='name']");
  const passwordError = root.querySelector("[data-error='password']");
  const emailLink = root.querySelector("[data-email-link]");

  bindPasswordToggle(root, passwordInput);

  const touch = { email: false, name: false, password: false };
  let emailServerError = null;

  emailInput.addEventListener("blur", () => {
    touch.email = true;
    setFieldError(emailInput, emailError, emailServerError ?? validateEmail(emailInput.value));
  });
  nameInput.addEventListener("blur", () => {
    touch.name = true;
    setFieldError(nameInput, nameError, validateName(nameInput.value));
  });
  passwordInput.addEventListener("blur", () => {
    touch.password = true;
    setFieldError(passwordInput, passwordError, validatePassword(passwordInput.value));
  });

  emailInput.addEventListener("input", () => {
    emailServerError = null;
    emailLink.hidden = true;
    if (touch.email) setFieldError(emailInput, emailError, validateEmail(emailInput.value));
  });
  nameInput.addEventListener("input", () => {
    if (touch.name) setFieldError(nameInput, nameError, validateName(nameInput.value));
  });
  passwordInput.addEventListener("input", () => {
    if (touch.password) setFieldError(passwordInput, passwordError, validatePassword(passwordInput.value));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.innerHTML = "";
    emailServerError = null;
    emailLink.hidden = true;

    touch.email = true;
    touch.name = true;
    touch.password = true;
    const nextEmailError = validateEmail(emailInput.value);
    const nextNameError = validateName(nameInput.value);
    const nextPasswordError = validatePassword(passwordInput.value);
    setFieldError(emailInput, emailError, nextEmailError);
    setFieldError(nameInput, nameError, nextNameError);
    setFieldError(passwordInput, passwordError, nextPasswordError);
    if (nextEmailError || nextNameError || nextPasswordError) return;

    setLoading(submit, true, "Создаём аккаунт…");

    try {
      const response = await register({
        email: emailInput.value.trim(),
        password: passwordInput.value,
        full_name: nameInput.value.trim(),
      });
      setAccessToken(response.access_token);
      setStoredUser(response.user);

      let resumeStatus = null;
      try {
        const me = await getMe();
        setProfile(me.profile);
        resumeStatus = me.profile?.resume_status ?? null;
      } catch {
        // Ничего страшного: профиль загрузится позже.
      }

      navigate(resumeStatus === "none" ? "/onboarding" : "/feed");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "email_taken") {
        emailServerError = error.message;
        setFieldError(emailInput, emailError, emailServerError);
        emailLink.hidden = false;
        emailLink.innerHTML = `Уже есть аккаунт? <a href="${withBase(`/login?email=${encodeURIComponent(emailInput.value.trim())}`)}" data-link data-to="/login?email=${encodeURIComponent(emailInput.value.trim())}">Войти с этой почтой</a>`;
      } else {
        formError.innerHTML = apiErrorAlert(error, "register-error");
      }
      setLoading(submit, false, "Зарегистрироваться");
    }
  });
}

function authLayout({ title, subtitle, form, footer }) {
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
        <p class="auth-brand__foot">PODBORpro · демонстрационная версия</p>
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

function bindPasswordToggle(root, input) {
  const button = root.querySelector("[data-toggle-password]");
  if (!button) return;

  button.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.innerHTML = icon(visible ? "eye" : "eyeOff");
    button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
  });
}

function validateEmail(email) {
  const value = email.trim();
  if (!value) return "Укажите почту";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Похоже, в почте опечатка";
  return null;
}

function validatePassword(password) {
  if (!password) return "Укажите пароль";
  if (password.length < 8) return "Пароль должен быть не короче 8 символов";
  return null;
}

function validateName(name) {
  if (!name.trim()) return "Укажите имя";
  return null;
}

function setFieldError(input, errorElement, message) {
  input.classList.toggle("input--invalid", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
  errorElement.textContent = message ?? "";
}

function apiErrorAlert(error, testId) {
  if (error instanceof ApiError) {
    if (error.code === "network") {
      return alert("error", "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.", `data-testid="${testId}"`);
    }
    return alert("error", error.message, `data-testid="${testId}"`);
  }
  return alert("error", "Что-то пошло не так. Попробуйте ещё раз.", `data-testid="${testId}"`);
}

function setLoading(button, loading, label) {
  button.disabled = loading;
  button.innerHTML = loading ? `${spinner()}<span>${esc(label)}</span>` : `<span>${esc(label)}</span>${icon("arrow")}`;
}

function safeFrom(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}
