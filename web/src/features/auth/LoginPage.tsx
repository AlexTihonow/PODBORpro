import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useAuthStore } from "@/auth/useAuthStore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { validateEmail, validatePassword } from "@/lib/validation";
import { TEST_IDS } from "@/testing/testIds";

import { AuthLayout } from "./AuthLayout";

interface LocationState {
  from?: { pathname?: string };
  email?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const login = useAuthStore((store) => store.login);

  const [email, setEmail] = useState(state.email ?? "");
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
      await login(email, password);
      const resumeStatus = useAuthStore.getState().resumeStatus;
      const from = state.from?.pathname;
      navigate(resumeStatus === "none" ? "/onboarding" : from ?? "/feed", { replace: true });
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
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          className="w-full"
          loading={submitting}
          data-testid={TEST_IDS.loginSubmit}
        >
          {submitting ? "Входим…" : "Войти"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Нет аккаунта?{" "}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Зарегистрироваться
        </Link>
      </p>
    </AuthLayout>
  );
}
