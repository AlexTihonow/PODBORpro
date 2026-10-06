import type {
  ApplicationStatus,
  Grade,
  ResumeStatus,
  Tone,
  WorkFormat,
} from "@/api/types";

const numberFormat = new Intl.NumberFormat("ru-RU");

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
};

export interface SalaryLike {
  salary_from: number | null;
  salary_to: number | null;
  currency: string | null;
}

/** «180 000 ₽», «от 120 000 ₽», «120 000–180 000 ₽», «Зарплата не указана». */
export function formatSalary(value: SalaryLike): string {
  if (value.salary_from == null && value.salary_to == null) {
    return "Зарплата не указана";
  }
  const symbol = CURRENCY_SYMBOLS[value.currency ?? "RUB"] ?? value.currency ?? "";
  if (value.salary_from != null && value.salary_to != null) {
    return `${numberFormat.format(value.salary_from)}–${numberFormat.format(value.salary_to)} ${symbol}`.trim();
  }
  if (value.salary_from != null) {
    return `от ${numberFormat.format(value.salary_from)} ${symbol}`.trim();
  }
  return `до ${numberFormat.format(value.salary_to as number)} ${symbol}`.trim();
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/** Оценка 0..1 в процентах: 0.83 -> «83%». */
export function scorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export type ScoreTone = "success" | "warning" | "neutral";

export function scoreTone(score: number): ScoreTone {
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";
  return "neutral";
}

const GRADE_LABELS: Record<Grade, string> = {
  junior: "Джуниор",
  middle: "Мидл",
  senior: "Сеньор",
};

export function gradeLabel(grade: Grade | null | undefined): string {
  return grade ? GRADE_LABELS[grade] : "Уровень не указан";
}

const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  office: "Офис",
  remote: "Удалённо",
  hybrid: "Гибрид",
};

export function workFormatLabel(format: WorkFormat | null | undefined): string {
  return format ? WORK_FORMAT_LABELS[format] : "";
}

const TONE_LABELS: Record<Tone, string> = {
  formal: "Формальный",
  neutral: "Нейтральный",
  friendly: "Дружелюбный",
};

export function toneLabel(tone: Tone): string {
  return TONE_LABELS[tone];
}

const RESUME_STATUS_LABELS: Record<ResumeStatus, string> = {
  none: "Резюме не загружено",
  processing: "Резюме обрабатывается",
  ready: "Резюме готово",
  failed: "Не удалось разобрать резюме",
};

export function resumeStatusLabel(status: ResumeStatus): string {
  return RESUME_STATUS_LABELS[status];
}

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  interview: "Интервью",
  offer: "Оффер",
  rejected: "Отказ",
};

export function applicationStatusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUS_LABELS[status];
}

const SOURCE_LABELS: Record<string, string> = {
  headhunter: "HeadHunter",
  superjob: "SuperJob",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
