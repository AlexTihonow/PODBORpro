import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Grade, Tone, WorkFormat } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

const STEPS = ["Резюме", "Навыки", "Должность и условия"];
const SAMPLE_SKILLS = ["Go", "PostgreSQL", "Docker", "Kubernetes", "Python", "gRPC"];

const WORK_FORMATS: Array<{ value: WorkFormat; label: string }> = [
  { value: "office", label: "Офис" },
  { value: "remote", label: "Удалённо" },
  { value: "hybrid", label: "Гибрид" },
];

export function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">Первичная настройка</h1>
      <StepIndicator current={step} />
      <Card className="p-6">
        {step === 0 && <ResumeStep onNext={() => setStep(1)} />}
        {step === 1 && <SkillsStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <PreferencesStep onBack={() => setStep(1)} />}
      </Card>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-medium",
              index === current
                ? "bg-brand-600 text-white"
                : index < current
                  ? "bg-brand-100 text-brand-700"
                  : "bg-surface-muted text-ink-subtle",
            )}
          >
            {index + 1}
          </span>
          <span
            className={cn(
              "text-sm",
              index === current ? "font-medium text-ink" : "text-ink-subtle",
            )}
          >
            {label}
          </span>
          {index < STEPS.length - 1 && <span className="h-px w-6 bg-edge" />}
        </li>
      ))}
    </ol>
  );
}

function ResumeStep({ onNext }: { onNext: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Загрузите резюме</h2>
        <p className="mt-1 text-sm text-ink-muted">
          PDF или DOCX, до 10 МБ. Мы разберём навыки и проекты автоматически.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-edge p-10 text-center transition-colors hover:border-brand-400">
        <input
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        <span className="text-sm font-medium text-ink">{fileName ?? "Выберите файл резюме"}</span>
        <span className="text-xs text-ink-subtle">PDF или DOCX, до 10 МБ</span>
      </label>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!fileName}>
          Продолжить
        </Button>
      </div>
    </div>
  );
}

function SkillsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["Go", "PostgreSQL", "Docker"]),
  );

  function toggle(skill: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Подтвердите навыки</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Мы нашли их в резюме. Снимите лишнее — от этого зависит точность подбора.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SAMPLE_SKILLS.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => toggle(skill)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              selected.has(skill)
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-edge bg-surface text-ink-muted hover:bg-surface-subtle",
            )}
          >
            {skill}
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={onNext}>Продолжить</Button>
      </div>
    </div>
  );
}

function PreferencesStep({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [targetTitle, setTargetTitle] = useState("Разработчик на Go");
  const [grade, setGrade] = useState<Grade>("junior");
  const [cities, setCities] = useState("Москва");
  const [workFormats, setWorkFormats] = useState<Set<WorkFormat>>(
    () => new Set(["remote"]),
  );
  const [salaryFrom, setSalaryFrom] = useState("120000");
  const [tone, setTone] = useState<Tone>("neutral");

  function toggleFormat(format: WorkFormat) {
    setWorkFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Должность и условия</h2>
        <p className="mt-1 text-sm text-ink-muted">
          По ним мы будем искать подходящие вакансии.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Желаемая должность" htmlFor="onb-title" required>
          <Input
            id="onb-title"
            value={targetTitle}
            onChange={(event) => setTargetTitle(event.target.value)}
          />
        </Field>

        <Field label="Уровень" htmlFor="onb-grade">
          <Select id="onb-grade" value={grade} onChange={(event) => setGrade(event.target.value as Grade)}>
            <option value="junior">Джуниор</option>
            <option value="middle">Мидл</option>
            <option value="senior">Сеньор</option>
          </Select>
        </Field>

        <Field label="Города" htmlFor="onb-cities">
          <Input
            id="onb-cities"
            value={cities}
            onChange={(event) => setCities(event.target.value)}
            placeholder="Москва, Санкт-Петербург"
          />
        </Field>

        <Field label="Зарплата от, ₽" htmlFor="onb-salary">
          <Input
            id="onb-salary"
            type="number"
            min={0}
            value={salaryFrom}
            onChange={(event) => setSalaryFrom(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Формат работы">
        <div className="flex flex-wrap gap-2">
          {WORK_FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => toggleFormat(format.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                workFormats.has(format.value)
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-edge bg-surface text-ink-muted hover:bg-surface-subtle",
              )}
            >
              {format.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Тон писем" htmlFor="onb-tone">
        <Select id="onb-tone" value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
          <option value="formal">Формальный</option>
          <option value="neutral">Нейтральный</option>
          <option value="friendly">Дружелюбный</option>
        </Select>
      </Field>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={() => navigate("/feed")}>Готово</Button>
      </div>
    </div>
  );
}
