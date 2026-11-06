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
import { tagFromRules } from "./tag-rules.ts";
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

  const ruleTag = tagFromRules(item.title, skills);
  const questions: QuestionSet = {};
  if (!ruleTag) questions.tag = tagQuestion([])!;
  if (!grade) questions.grade = gradeQuestion(gradesForExperience(item.experience) ?? undefined);
  if (!workFormat) questions.work_format = workFormatQuestion;
  if ("ask" in english) questions.english = englishQuestion;

  const answers = Object.keys(questions).length > 0 ? (await model.systemOne(state, questions)).answers : {};
  const tagState = { title: item.title, skills: skills.join(", ") };
  const tags = ruleTag
    ? await fromRule(model, tagState, ruleTag)
    : await descend(model, tagState, [], answers.tag as ChoiceAnswer, 1);

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

async function fromRule(model: Model, state: unknown, path: string[]): Promise<TagAnswer[]> {
  if (!childrenAt(path)) return finish(path, RULE_CONFIDENCE, "leaf", "rule");
  const { answers } = await model.systemOne(state, { tag: tagQuestion(path)! });
  return descend(model, state, path, answers.tag as ChoiceAnswer, RULE_CONFIDENCE);
}

async function descend(
  model: Model,
  state: unknown,
  start: string[],
  first: ChoiceAnswer,
  startConfidence: number,
): Promise<TagAnswer[]> {
  const path = [...start];
  let answer = first;
  let confidence = startConfidence;
  const source = start.length > 0 ? "rule" : "laya";

  while (true) {
    if (answer.choice === OTHER) return finish(path, confidence, "other", source);
    if (answer.answer_confidence < TAG_THRESHOLD) return finish(path, confidence, "low_confidence", source);

    path.push(answer.choice);
    confidence = answer.answer_confidence;
    const next = tagQuestion(path);
    if (!next) return finish(path, confidence, "leaf", "laya");

    const { answers } = await model.systemOne(state, { tag: next });
    answer = answers.tag as ChoiceAnswer;
  }
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
