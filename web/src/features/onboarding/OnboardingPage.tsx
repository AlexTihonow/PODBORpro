import { useState } from "react";

import type { Grade, Tone, WorkFormat } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { navigate } from "@/router";

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
    <div className="onboarding">
      <h1 className="page-title">Первичная настройка</h1>
      <StepIndicator current={step} />
      <Card className="onboarding-card">
        {step === 0 && <ResumeStep onNext={() => setStep(1)} />}
        {step === 1 && <SkillsStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <PreferencesStep onBack={() => setStep(1)} />}
      </Card>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="steps">
      {STEPS.map((label, index) => (
        <li key={label} className="step">
          <span
            className={cn(
              "step",
              index === current ? "step--active" : index < current ? "step--done" : null,
            )}
          >
            <span className="step__num">{index + 1}</span>
            <span className="step__label">{label}</span>
          </span>
          {index < STEPS.length - 1 && <span className="step-line" />}
        </li>
      ))}
    </ol>
  );
}

function ResumeStep({ onNext }: { onNext: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="onboarding-step">
      <div>
        <h2 className="onboarding-step__title">Загрузите резюме</h2>
        <p className="onboarding-step__text">
          PDF или DOCX, до 10 МБ. Мы разберём навыки и проекты автоматически.
        </p>
      </div>

      <label className="upload-drop">
        <input
          type="file"
          accept=".pdf,.docx"
          className="input"
          style={{ display: "none" }}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        <span className="upload-drop__name">{fileName ?? "Выберите файл резюме"}</span>
        <span className="upload-drop__hint">PDF или DOCX, до 10 МБ</span>
      </label>

      <div className="form-actions">
        <span />
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
    <div className="onboarding-step">
      <div>
        <h2 className="onboarding-step__title">Подтвердите навыки</h2>
        <p className="onboarding-step__text">
          Мы нашли их в резюме. Снимите лишнее — от этого зависит точность подбора.
        </p>
      </div>

      <div className="toggle-list">
        {SAMPLE_SKILLS.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => toggle(skill)}
            className={cn("toggle", selected.has(skill) && "toggle--on")}
          >
            {skill}
          </button>
        ))}
      </div>

      <div className="form-actions">
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={onNext}>Продолжить</Button>
      </div>
    </div>
  );
}

function PreferencesStep({ onBack }: { onBack: () => void }) {
  const [targetTitle, setTargetTitle] = useState("Разработчик на Go");
  const [grade, setGrade] = useState<Grade>("junior");
  const [cities, setCities] = useState("Москва");
  const [workFormats, setWorkFormats] = useState<Set<WorkFormat>>(() => new Set(["remote"]));
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
    <div className="onboarding-step">
      <div>
        <h2 className="onboarding-step__title">Должность и условия</h2>
        <p className="onboarding-step__text">По ним мы будем искать подходящие вакансии.</p>
      </div>

      <div className="form-grid">
        <Field label="Желаемая должность" htmlFor="onb-title" required>
          <Input
            id="onb-title"
            value={targetTitle}
            onChange={(event) => setTargetTitle(event.target.value)}
          />
        </Field>

        <Field label="Уровень" htmlFor="onb-grade">
          <Select
            id="onb-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value as Grade)}
          >
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
        <div className="toggle-list">
          {WORK_FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => toggleFormat(format.value)}
              className={cn("toggle", workFormats.has(format.value) && "toggle--on")}
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

      <div className="form-actions">
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={() => navigate("/feed")}>Готово</Button>
      </div>
    </div>
  );
}
