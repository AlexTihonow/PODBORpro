import type { Label } from "./types.ts";

const GRADE_PATTERNS: [string, RegExp][] = [
  ["intern", /(стаж[её]р|интерн|intern|trainee|практикант)/i],
  ["lead", /(team ?lead|tech ?lead|тимлид|техлид|\blead\b|руководител|head of)/i],
  ["senior", /(senior|сеньор|синьор|старш|ведущ)/i],
  ["middle", /(middle|мидл)/i],
  ["junior", /(junior|джун|младш)/i],
];

const ENGLISH = /(англ|english)/i;
const ENGLISH_LEVEL = /((англ|english)[^.\n]{0,40}\b([abc][12]|intermediate|upper|advanced|fluent|свободн|разговорн))|(\b[abc][12]\b[^.\n]{0,20}(англ|english))/i;

const EXPERIENCE_GRADES: [RegExp, string[]][] = [
  [/(не требуется|нет опыта|без опыта)/i, ["intern", "junior"]],
  [/1\s*[–-]\s*3/, ["junior", "middle"]],
  [/3\s*[–-]\s*6/, ["middle", "senior"]],
  [/(более 6|от 6|6\+)/i, ["senior", "lead"]],
];

export function gradeFromTitle(title: string): Label<string> | null {
  const found = GRADE_PATTERNS.filter(([, pattern]) => pattern.test(title)).map(([grade]) => grade);
  if (found.length !== 1) return null;
  return { value: found[0], confidence: 0.95, source: "rule" };
}

export function workFormatFromSource(raw: string | undefined): Label<string> | null {
  const text = (raw ?? "").toLowerCase();
  if (!text) return null;
  if (text.includes("удал")) return { value: "remote", confidence: 0.95, source: "source" };
  if (text.includes("гибрид")) return { value: "hybrid", confidence: 0.95, source: "source" };
  if (text.includes("на месте") || text.includes("офис")) return { value: "office", confidence: 0.95, source: "source" };
  return null;
}

export type Mention = { decided: Label<boolean> } | { ask: true };

export function englishRule(text: string, skills: string[]): Mention {
  const haystack = `${skills.join(". ")}. ${text}`;
  if (ENGLISH_LEVEL.test(haystack)) return { decided: { value: true, confidence: 0.95, source: "rule" } };
  if (!ENGLISH.test(haystack)) return { decided: { value: false, confidence: 0.9, source: "rule" } };
  return { ask: true };
}

export function gradesForExperience(experience: string | undefined): string[] | null {
  const found = EXPERIENCE_GRADES.find(([pattern]) => pattern.test(experience ?? ""));
  return found ? found[1] : null;
}
