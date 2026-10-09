import type { ReactNode } from "react";

import { Link } from "@/components/Link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { formatSalary } from "@/lib/format";

const PREVIEW_LINKS = [
  { to: "/feed?preview=loading", label: "Лента: загрузка" },
  { to: "/feed?preview=empty", label: "Лента: пусто" },
  { to: "/feed?preview=error", label: "Лента: ошибка" },
  { to: "/feed?preview=simplified", label: "Лента: подбор упрощён" },
  { to: "/vacancies/4821?preview=loading", label: "Карточка: загрузка" },
  { to: "/vacancies/4821?preview=error", label: "Карточка: ошибка" },
  { to: "/applications?preview=empty", label: "Отклики: пусто" },
];

export function DevComponentsPage() {
  return (
    <div className="container dev-page">
      <header>
        <h1 className="page-title">Служебная страница компонентов</h1>
        <p className="field__hint">
          Базовые элементы и состояния экранов. Страницы за логином — сначала войдите.
        </p>
      </header>

      <Section title="Кнопки">
        <div className="dev-row">
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Призрачная</Button>
          <Button variant="danger">Опасная</Button>
          <Button loading>Отправка…</Button>
          <Button disabled>Недоступна</Button>
          <Button size="sm">Маленькая</Button>
          <Button size="lg">Большая</Button>
        </div>
      </Section>

      <Section title="Поля">
        <div className="dev-stack" style={{ maxWidth: 576 }}>
          <Field label="Обычное поле" htmlFor="dev-input">
            <Input id="dev-input" placeholder="Например, почта" />
          </Field>
          <Field label="Поле с ошибкой" htmlFor="dev-input-error" error="Похоже, в почте опечатка">
            <Input id="dev-input-error" invalid defaultValue="ivan@" />
          </Field>
          <Field label="Текстовая область" htmlFor="dev-textarea">
            <Textarea id="dev-textarea" rows={3} placeholder="Текст письма" />
          </Field>
          <Field label="Выпадающий список" htmlFor="dev-select">
            <Select id="dev-select" defaultValue="junior">
              <option value="junior">Джуниор</option>
              <option value="middle">Мидл</option>
              <option value="senior">Сеньор</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Сообщения">
        <div className="dev-stack">
          <Alert tone="error">Неверная почта или пароль.</Alert>
          <Alert tone="warning">Подбор упрощён: сервис подбора временно недоступен.</Alert>
          <Alert tone="info">Резюме обрабатывается — обновим ленту автоматически.</Alert>
          <Alert tone="success">Аккаунт создан.</Alert>
        </div>
      </Section>

      <Section title="Бейджи и чипы">
        <div className="dev-row">
          <Badge tone="neutral">Нейтральный</Badge>
          <Badge tone="brand">83%</Badge>
          <Badge tone="success">Совпало</Badge>
          <Badge tone="warning">Не хватает</Badge>
          <Badge tone="danger">Ошибка</Badge>
          <Chip>Go</Chip>
          <Chip>PostgreSQL</Chip>
          <Chip>Docker</Chip>
        </div>
      </Section>

      <Section title="Загрузка">
        <div className="dev-row">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-muted)" }}>
            <Spinner /> Загружаем…
          </span>
          <div className="dev-stack" style={{ width: "100%", maxWidth: 448 }}>
            <Skeleton style={{ height: 20, width: "75%" }} />
            <Skeleton style={{ height: 16, width: "33%" }} />
            <Skeleton style={{ height: 16, width: "100%" }} />
          </div>
        </div>
      </Section>

      <Section title="Пусто и ошибка">
        <div className="dev-grid">
          <Card>
            <EmptyState
              title="Подходящих вакансий пока нет"
              description="Попробуйте убрать часть фильтров или изменить желаемую должность."
            />
          </Card>
          <Card>
            <ErrorState title="Не получилось загрузить ленту" message="Проверьте подключение к интернету." />
          </Card>
        </div>
      </Section>

      <Section title="Краевые случаи вёрстки">
        <Card className="vacancy-card" style={{ maxWidth: 576 }}>
          <p className="vacancy-card__title line-clamp-2">
            Ведущий инженер-программист по разработке высоконагруженных распределённых систем
            обработки данных на Go с опытом работы в платёжных сервисах
          </p>
          <p className="vacancy-card__company">
            {formatSalary({ salary_from: null, salary_to: null, currency: null })}
          </p>
          <p className="vacancy-card__company">
            {formatSalary({ salary_from: 120000, salary_to: 180000, currency: "RUB" })}
          </p>
        </Card>
      </Section>

      <Section title="Макеты экранов (состояния)">
        <p className="field__hint" style={{ marginBottom: 12 }}>
          Параметр <code className="dev-code">?preview=…</code> включает состояние без сервера.
        </p>
        <div className="dev-links">
          {PREVIEW_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="dev-link">
              {link.label}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="dev-section__title">{title}</h2>
      {children}
    </section>
  );
}
