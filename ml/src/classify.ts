import type { Answer, ChoiceAnswer, NoulAnswer } from "@receptron/laya";
import {
  englishQuestion,
  gradeQuestion,
  OTHER,
  type QuestionSet,
  tagQuestion,
  workFormatQuestion,
} from "./questions.ts";
import { englishRule, gradeFromTitle, gradesForExperience, workFormatFromSource } from "./rules.ts";
import { analyze, attributes, decide, dropAncestors, type Analysis } from "./ru/engine.ts";
import { childrenAt, labelFor, TAG_ROOT } from "./tags.ts";
import type { Classification, Label, LabelSource, TagAnswer, VacancyItem } from "./types.ts";

export interface Model {
  systemOne(state: unknown, questions: QuestionSet): Promise<{ answers: Record<string, Answer> }>;
}

export const TAG_THRESHOLD = 0.45;
export const REVIEW_THRESHOLD = 0.5;
export const RULE_CONFIDENCE = 0.95;

export async function classify(model: Model, item: VacancyItem): Promise<Classification> {
  const state = { title: item.title, experience: item.experience ?? "", text: item.text };
  const skills = item.skills ?? [];

  const grade = gradeFromTitle(item.title);
  const workFormat = workFormatFromSource(item.work_format_raw);
  const english = englishRule(item.text, skills);

  const questions: QuestionSet = {};
  if (!grade) questions.grade = gradeQuestion(gradesForExperience(item.experience) ?? undefined);
  if (!workFormat) questions.work_format = workFormatQuestion;
  if ("ask" in english) questions.english = englishQuestion;

  const answers = Object.keys(questions).length > 0 ? (await model.systemOne(state, questions)).answers : {};
  const analysis = analyze({ title: item.title, skills, text: item.text });
  const tags = withAttributes(analysis, await walk(model, analysis, [], 1, "rule"));

  const result: Classification = {
    id: item.id,
    answers: {
      tags,
      grade: grade ?? fromChoice(answers.grade),
      work_format: workFormat ?? fromChoice(answers.work_format),
      english: "decided" in english ? english.decided : fromNoul(answers.english),
    },
    needs_review: false,
  };
  result.needs_review = needsReview(result);
  return result;
}

// Laya плохо понимает русский, поэтому получает английский пересказ вакансии,
// собранный из найденных понятий, а не исходный текст.
export function englishState(analysis: Analysis) {
  const { title, skills, mentions } = analysis.brief;
  return { title, skills: skills.join(", "), mentions: mentions.join(", ") };
}

async function walk(
  model: Model,
  analysis: Analysis,
  path: string[],
  confidence: number,
  source: LabelSource,
): Promise<TagAnswer[]> {
  if (path.length > 0 && !childrenAt(path)) return finish(path, confidence, "leaf", source);

  const decision = decide(analysis, path);
  switch (decision.kind) {
    case "non_it":
      return [];
    case "stop":
      return finish(path, confidence, "no_evidence", source);
    case "pick": {
      const tags: TagAnswer[] = [];
      for (const pick of decision.picks) {
        tags.push(...(await walk(model, analysis, [...path, pick.key], Math.min(confidence, pick.confidence), source)));
      }
      return tags;
    }
    case "ask": {
      const question = tagQuestion(path, decision.candidates)!;
      const { answers } = await model.systemOne(englishState(analysis), { tag: question });
      const answer = answers.tag as ChoiceAnswer;
      if (answer.choice === OTHER) return finish(path, confidence, "other", source);
      if (answer.answer_confidence < TAG_THRESHOLD) return finish(path, confidence, "low_confidence", source);
      return walk(model, analysis, [...path, answer.choice], answer.answer_confidence, "laya");
    }
  }
}

// Добавляет теги-признаки (AI-интеграция, AI-assisted и т. п.) к основным тегам.
function withAttributes(analysis: Analysis, tags: TagAnswer[]): TagAnswer[] {
  if (decide(analysis, []).kind === "non_it") return tags;
  const all = [...tags, ...attributes(analysis).flatMap((path) => finish(path, RULE_CONFIDENCE, "leaf", "rule"))];
  const keep = new Set(dropAncestors(all.map((t) => t.path)));
  return all.filter((t) => keep.delete(t.path));
}

function finish(path: string[], confidence: number, stopped: TagAnswer["stopped"], source: LabelSource): TagAnswer[] {
  if (path.length === 0) return [];
  return [{ path: [TAG_ROOT, ...path].join("/"), label: labelFor(path), confidence: round(confidence), stopped, source }];
}

function fromChoice(answer: Answer | undefined): Label<string | null> {
  const choice = answer as ChoiceAnswer | undefined;
  if (!choice) return { value: null, confidence: 0, source: "laya" };
  return { value: choice.choice, confidence: round(choice.answer_confidence), source: "laya" };
}

function fromNoul(answer: Answer | undefined): Label<boolean> {
  const noul = answer as NoulAnswer | undefined;
  if (!noul) return { value: false, confidence: 0, source: "laya" };
  return { value: noul.noul >= 0.5, confidence: round(noul.answer_confidence), source: "laya" };
}

function needsReview({ answers }: Classification): boolean {
  const fromModel = [answers.grade, answers.work_format, answers.english].filter(
    (label) => label.source === "laya",
  );
  return answers.tags.length === 0 || fromModel.some((label) => label.confidence < REVIEW_THRESHOLD);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
