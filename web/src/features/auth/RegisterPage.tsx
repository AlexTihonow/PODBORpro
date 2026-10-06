import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useAuthStore } from "@/auth/useAuthStore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { validateEmail, validateName, validatePassword } from "@/lib/validation";
import { TEST_IDS } from "@/testing/testIds";

import { AuthLayout } from "./AuthLayout";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((store) => store.register);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, name: false, password: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [emailServerError, setEmailServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailError =
    emailServerError ?? (touched.email ? validateEmail(email) : null);
  const nameError = touched.name ? validateName(name) : null;
  const passwordError = touched.password ? validatePassword(password) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    const nextNameError = validateName(name);
    const nextPasswordError = validatePassword(password);
    setTouched({ email: true, name: true, password: true });
    if (nextEmailError || nextNameError || nextPasswordError) return;
    void submit();
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    setEmailServerError(null);
    try {
      await register({ email: email.trim(), password, full_name: name.trim() });
      const resumeStatus = useAuthStore.getState().resumeStatus;
      navigate(resumeStatus === "none" ? "/onboarding" : "/feed", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && error.code === "email_taken") {
          // Текст из ответа сервера, показываем под полем почты.
          setEmailServerError(error.message);
        } else if (error.code === "network") {
          setFormError("Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.");
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Регистрация" subtitle="Создайте аккаунт за минуту">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <Alert tone="error" data-testid={TEST_IDS.registerError}>
            {formError}
          </Alert>
        )}

        <Field label="Почта" htmlFor="register-email" error={emailError} required>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="ivan@mail.ru"
            value={email}
            invalid={Boolean(emailError)}
            data-testid={TEST_IDS.registerEmail}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailServerError(null);
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          />
        </Field>
        {emailServerError && (
          <p className="-mt-2 text-sm">
            <Link
              to="/login"
              state={{ email: email.trim() }}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Войти с этой почтой
            </Link>
          </p>
        )}

        <Field label="Имя" htmlFor="register-name" error={nameError} required>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            placeholder="Иван Петров"
            value={name}
            invalid={Boolean(nameError)}
            data-testid={TEST_IDS.registerName}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
          />
        </Field>

        <Field label="Пароль" htmlFor="register-password" error={passwordError} required>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="От 8 символов"
            value={password}
            invalid={Boolean(passwordError)}
            data-testid={TEST_IDS.registerPassword}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          />
        </Field>

        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          data-testid={TEST_IDS.registerSubmit}
        >
          {submitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Войти
        </Link>
      </p>
    </AuthLayout>
  );
}
