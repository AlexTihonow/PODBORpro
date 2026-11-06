export interface VacancyItem {
  id: string;
  title: string;
  text: string;
  experience?: string;
  work_format_raw?: string;
  skills?: string[];
}

export type LabelSource = "rule" | "laya" | "source";

export interface Label<T = unknown> {
  value: T;
  confidence: number;
  source: LabelSource;
}

export interface TagAnswer {
  path: string;
  label: string;
  confidence: number;
  stopped: "leaf" | "low_confidence" | "other";
  source: LabelSource;
}

export interface Classification {
  id: string;
  answers: {
    tags: TagAnswer[];
    grade: Label<string | null>;
    work_format: Label<string | null>;
    english: Label<boolean>;
  };
  needs_review: boolean;
}
