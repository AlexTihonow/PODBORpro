import { ApiError, login } from "../../api/index.js";
import { navigate, withBase } from "../../core/router.js";
import { mountPublic } from "../../ui/shell.js";
import {
  apiErrorAlert,
  authLayout,
  bindField,
  bindPasswordToggle,
  checkAll,
  passwordField,
  setLoading,
  startSession,
  submitButton,
  textField,
  validators,
} from "./form.js";

export function renderLoginPage() {
  const params = new URLSearchParams(location.search);
  const from = safeFrom(params.get("from"));
  const prefillEmail = params.get("email") ?? history.state?.email ?? "";

  const root = mountPublic(
    authLayout({
      title: "Вход",
      subtitle: "Войдите, чтобы увидеть персональную ленту вакансий.",
      form: `<form class="auth-form" data-form novalidate>
        <div data-form-error></div>
        ${textField({
          id: "login-email",
          name: "email",
          type: "email",
          label: "Почта",
          iconName: "mail",
          autocomplete: "email",
          placeholder: "ivan@mail.ru",
          value: prefillEmail,
          testId: "login-email",
        })}
        ${passwordField({ id: "login-password", autocomplete: "current-password", testId: "login-password" })}
        ${submitButton("Войти", "login-submit")}
      </form>`,
      footer: `Нет аккаунта? <a href="${withBase("/register")}" data-link data-to="/register">Зарегистрироваться</a>`,
    }),
  );

  const form = root.querySelector("[data-form]");
  const submit = root.querySelector("[type='submit']");
  const formError = root.querySelector("[data-form-error]");
  const email = bindField(root, "email", validators.email);
  const password = bindField(root, "password", validators.password);
  bindPasswordToggle(root);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.innerHTML = "";
    if (!checkAll([email, password])) return;

    setLoading(submit, true, "Входим…");
    try {
      const response = await login(email.input.value.trim(), password.input.value);
      const resumeStatus = await startSession(response);
      navigate(resumeStatus === "none" ? "/onboarding" : from || "/feed");
    } catch (error) {
      formError.innerHTML = apiErrorAlert(error, "login-error");
      if (error instanceof ApiError && error.status === 401) {
        password.input.value = "";
        password.input.focus();
      }
      setLoading(submit, false, "Войти");
    }
  });
}

function safeFrom(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}
