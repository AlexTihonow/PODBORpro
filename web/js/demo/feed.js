import { clone } from "./util.js";
import { listVacancies, loadCatalog, skillKey, toCard } from "./catalog.js";

const GRADES = ["intern", "junior", "middle", "senior", "lead"];
const WEIGHTS = { similarity: 0.35, skills: 0.35, grade: 0.15, freshness: 0.15 };
const FRESHNESS_DAYS = 30;
// Words (already cut to 6 chars by words()) that appear in almost every title and
// therefore say nothing about fit: without this every "Разработчик ..." matched every profile.
const GENERIC_WORDS = new Set([
  "разраб", "програ", "develo", "engine", "специа", "инжене", "сотруд", "работа",
  "junior", "middle", "senior", "lead", "джун", "мидл", "сеньор", "стажер", "стажёр",
  "intern", "ведущи", "старши", "младши", "главны", "team", "tech", "на", "по", "для",
]);

let cachedFeed = [];

export function getCachedFeedItem(id) {
  return cachedFeed.find((item) => item.vacancy.id === Number(id)) ?? null;
}

export async function buildFeed(profile, city) {
  const { generated_at } = await loadCatalog();
  const now = generated_at ? Date.parse(generated_at) : Date.now();
  let vacancies = await listVacancies();
  if (city) vacancies = vacancies.filter((vacancy) => vacancy.city === city);

  const ranked = vacancies
    .map((vacancy) => ({ vacancy, item: rank(vacancy, profile, now) }))
    .filter(({ vacancy, item }) => isRelevant(vacancy, item, profile))
    .map(({ item }) => item)
    // Skill matches first, title-only matches after them; score orders within each group.
    .sort((a, b) => hasSkillMatch(b) - hasSkillMatch(a) || b.score - a.score);
  // The feed shows every matching vacancy, best first.
  const items = ranked;

  cachedFeed = items;
  return { items: clone(items), total: items.length, simplified: false };
}

function rank(vacancy, profile, now) {
  const wanted = new Set((profile.skills ?? []).map((skill) => normalize(skill.name)));
  const names = unique(vacancy.skills.map((skill) => skill.name));
  // Vacancies without a parsed skill list still count a skill named in their title or tags.
  const text = textWords([vacancy.title, ...vacancy.tags.map((tag) => tag.label)].join(" "));
  const matched = unique([
    ...names.filter((name) => wanted.has(normalize(name))),
    ...(profile.skills ?? []).map((skill) => skill.name).filter((name) => text.has(normalize(name))),
  ]);
  const missing = names.filter((name) => !wanted.has(normalize(name))).slice(0, 4);
  const gradeFit = compareGrades(vacancy.grade, profile.target_grade);

  const parts = {
    similarity: similarity(profile.target_title, vacancy),
    skills: wanted.size === 0 ? 0 : matched.length / Math.min(wanted.size, Math.max(names.length, 1)),
    grade: { match: 1, lower: 0.6, higher: 0.4, unknown: 0.5 }[gradeFit],
    freshness: freshness(vacancy.published_at, now),
  };
  const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * Math.min(parts[key], 1), 0);

  return {
    vacancy: toCard(vacancy),
    score: round(score),
    explanation: {
      matched_skills: matched,
      missing_skills: missing,
      grade_fit: gradeFit,
      parts: Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, round(Math.min(value, 1))])),
    },
  };
}

// The feed is a filter, not just a sort: a vacancy must share a selected skill with the
// profile. The target title alone admits only vacancies that have no skill list to compare,
// and is the only criterion when the profile has no skills selected.
function isRelevant(vacancy, item, profile) {
  const { matched_skills: matched, parts } = item.explanation;
  if (matched.length > 0) return true;
  const hasProfileSkills = (profile.skills ?? []).length > 0;
  return parts.similarity > 0 && (!hasProfileSkills || vacancy.skills.length === 0);
}

function hasSkillMatch(item) {
  return item.explanation.matched_skills.length > 0 ? 1 : 0;
}

function textWords(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}+#.]+/u)
      .map((word) => normalize(word.replace(/\.$/, ""))),
  );
}

function similarity(targetTitle, vacancy) {
  const target = new Set([...words(targetTitle)].filter((word) => !GENERIC_WORDS.has(word)));
  if (target.size === 0) return 0;
  const haystack = [...words([vacancy.title, ...vacancy.tags.map((tag) => tag.label)].join(" "))].filter(
    (word) => !GENERIC_WORDS.has(word),
  );
  let hits = 0;
  for (const word of target) {
    if (haystack.some((candidate) => candidate.startsWith(word) || word.startsWith(candidate))) hits++;
  }
  return hits / target.size;
}

function compareGrades(grade, target) {
  const a = GRADES.indexOf(grade);
  const b = GRADES.indexOf(target);
  if (a < 0 || b < 0) return "unknown";
  if (a === b) return "match";
  return a < b ? "lower" : "higher";
}

function freshness(publishedAt, now) {
  const days = Math.max(0, (now - Date.parse(publishedAt)) / 864e5);
  return Math.exp(-days / FRESHNESS_DAYS);
}

function words(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}+#]+/u)
      .filter((word) => word.length > 1)
      .map((word) => word.slice(0, 6)),
  );
}

const normalize = skillKey;

function unique(names) {
  const seen = new Set();
  return names.filter((name) => {
    const key = normalize(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}
