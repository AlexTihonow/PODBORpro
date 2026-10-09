import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Link } from "@/components/Link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { getNavState, navigate } from "@/router";
import { validateEmail, validatePassword } from "@/lib/validation";
import { TEST_IDS } from "@/testing/testIds";

import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { login } = useAuth();
  const from = new URLSearchParams(window.location.search).get("from") ?? "";
  const navState = getNavState() as { email?: string } | null;

  const [email, setEmail] = useState(navState?.email ?? "");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailError = touched.email ? validateEmail(email) : null;
  const passwordError = touched.password ? validatePassword(password) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setTouched({ email: true, password: true });
    if (nextEmailError || nextPasswordError) return;
    void submit();
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      const status = await login(email, password);
      navigate(status === "none" ? "/onboarding" : from || "/feed");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          // «Неверная почта или пароль» — текст из ответа сервера.
          setFormError(error.message);
          setPassword("");
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
    <AuthLayout title="Вход" subtitle="Войдите, чтобы увидеть ленту вакансий">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <Alert tone="error" data-testid={TEST_IDS.loginError}>
            {formError}
          </Alert>
        )}

        <Field label="Почта" htmlFor="login-email" error={emailError} required>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="ivan@mail.ru"
            value={email}
            invalid={Boolean(emailError)}
            data-testid={TEST_IDS.loginEmail}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          />
        </Field>

        <Field label="Пароль" htmlFor="login-password" error={passwordError} required>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="От 8 символов"
            value={password}
            invalid={Boolean(passwordError)}
            data-testid={TEST_IDS.loginPassword}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          />
        </Field>

        <Button
          type="submit"
          className="btn--block"
          loading={submitting}
          data-testid={TEST_IDS.loginSubmit}
        >
          {submitting ? "Входим…" : "Войти"}
        </Button>
      </form>

      <p className="auth-footer">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </AuthLayout>
  );
}
