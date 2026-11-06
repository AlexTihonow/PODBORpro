import { ApiError, register } from "../../api/index.js";
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

export function renderRegisterPage() {
  const root = mountPublic(
    authLayout({
      title: "Регистрация",
      subtitle: "Создайте аккаунт за минуту — без лишних вопросов.",
      form: `<form class="auth-form" data-form novalidate>
        <div data-form-error></div>
        ${textField({
          id: "register-email",
          name: "email",
          type: "email",
          label: "Почта",
          iconName: "mail",
          autocomplete: "email",
          placeholder: "ivan@mail.ru",
          testId: "register-email",
          extra: `<span class="field__hint" data-email-link hidden></span>`,
        })}
        ${textField({
          id: "register-name",
          name: "name",
          type: "text",
          label: "Имя",
          iconName: "user",
          autocomplete: "name",
          placeholder: "Иван Петров",
          testId: "register-name",
        })}
        ${passwordField({ id: "register-password", autocomplete: "new-password", testId: "register-password" })}
        ${submitButton("Зарегистрироваться", "register-submit")}
      </form>`,
      footer: `Уже есть аккаунт? <a href="${withBase("/login")}" data-link data-to="/login">Войти</a>`,
    }),
  );

  const form = root.querySelector("[data-form]");
  const submit = root.querySelector("[type='submit']");
  const formError = root.querySelector("[data-form-error]");
  const emailLink = root.querySelector("[data-email-link]");
  const email = bindField(root, "email", validators.email);
  const name = bindField(root, "name", validators.name);
  const password = bindField(root, "password", validators.password);
  bindPasswordToggle(root);

  email.input.addEventListener("input", () => {
    emailLink.hidden = true;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.innerHTML = "";
    emailLink.hidden = true;
    email.override = null;
    if (!checkAll([email, name, password])) return;

    setLoading(submit, true, "Создаём аккаунт…");
    try {
      const response = await register({
        email: email.input.value.trim(),
        password: password.input.value,
        full_name: name.input.value.trim(),
      });
      const resumeStatus = await startSession(response);
      navigate(resumeStatus === "none" ? "/onboarding" : "/feed");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "email_taken") {
        showEmailTaken(email, emailLink, error.message);
      } else {
        formError.innerHTML = apiErrorAlert(error, "register-error");
      }
      setLoading(submit, false, "Зарегистрироваться");
    }
  });
}

function showEmailTaken(email, emailLink, message) {
  email.override = message;
  email.show(message);
  const target = `/login?email=${encodeURIComponent(email.input.value.trim())}`;
  emailLink.hidden = false;
  emailLink.innerHTML = `Уже есть аккаунт? <a href="${withBase(target)}" data-link data-to="${target}">Войти с этой почтой</a>`;
}
