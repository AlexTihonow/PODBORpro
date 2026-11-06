import type { ChoiceQuestion, NoulQuestion, Question } from "@receptron/laya";
import { childrenAt, type TagNode } from "./tags.ts";

export const OTHER = "other";

export const GRADES = ["intern", "junior", "middle", "senior", "lead"] as const;

const GRADE_CRITERIA: Record<string, string> = {
  intern: "internship or trainee, no experience",
  junior: "junior, up to 1-2 years of experience",
  middle: "middle, 2-4 years of experience",
  senior: "senior, 5+ years, expert",
  lead: "team lead, head, manages people",
};

export function gradeQuestion(allowed: readonly string[] = GRADES): ChoiceQuestion {
  const criteria = Object.fromEntries(allowed.map((grade) => [grade, GRADE_CRITERIA[grade]]));
  return { type: "choice", instructions: "What seniority level does this job vacancy require?", criteria };
}

export const workFormatQuestion: ChoiceQuestion = {
  type: "choice",
  instructions: "Where does the employee work according to this vacancy?",
  criteria: { office: "in the office", remote: "fully remote", hybrid: "office and remote mixed" },
};

export const englishQuestion: NoulQuestion = {
  type: "noul",
  instructions: "Does this vacancy require the candidate to know English?",
};

export function tagQuestion(path: string[]): ChoiceQuestion | null {
  const children = childrenAt(path);
  if (!children) return null;
  const criteria: Record<string, string> = {};
  for (const [key, node] of Object.entries(children) as [string, TagNode][]) criteria[key] = node.hint;
  criteria[OTHER] = "none of the above";
  const scope = path.length === 0 ? "this IT vacancy" : `this ${path.join(" ")} vacancy`;
  return { type: "choice", instructions: `Which specialization best describes ${scope}?`, criteria };
}

export type QuestionSet = Record<string, Question>;
