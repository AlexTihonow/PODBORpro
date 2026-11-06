import { clone } from "./util.js";
import { listVacancies, loadCatalog, toCard } from "./catalog.js";

const FEED_SIZE = 30;
const GRADES = ["intern", "junior", "middle", "senior", "lead"];
const WEIGHTS = { similarity: 0.35, skills: 0.35, grade: 0.15, freshness: 0.15 };
const FRESHNESS_DAYS = 30;
const SKILL_ALIASES = {
  golang: "go",
  postgres: "postgresql",
  "postgre sql": "postgresql",
  js: "javascript",
  ts: "typescript",
  k8s: "kubernetes",
  "node.js": "nodejs",
  node: "nodejs",
};

let cachedFeed = [];

export function getCachedFeedItem(id) {
  return cachedFeed.find((item) => item.vacancy.id === Number(id)) ?? null;
}

export async function buildFeed(profile, city) {
  const { generated_at } = await loadCatalog();
  const now = generated_at ? Date.parse(generated_at) : Date.now();
  let vacancies = await listVacancies();
  if (city) vacancies = vacancies.filter((vacancy) => vacancy.city === city);

  const items = vacancies
    .map((vacancy) => rank(vacancy, profile, now))
    .sort((a, b) => b.score - a.score)
    .slice(0, FEED_SIZE);

  cachedFeed = items;
  return { items: clone(items), total: items.length, simplified: false };
}

function rank(vacancy, profile, now) {
  const wanted = new Set((profile.skills ?? []).map((skill) => normalize(skill.name)));
  const names = unique(vacancy.skills.map((skill) => skill.name));
  const matched = names.filter((name) => wanted.has(normalize(name)));
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

function similarity(targetTitle, vacancy) {
  const target = words(targetTitle);
  if (target.size === 0) return 0;
  const haystack = words([vacancy.title, ...vacancy.tags.map((tag) => tag.label)].join(" "));
  let hits = 0;
  for (const word of target) {
    if ([...haystack].some((candidate) => candidate.startsWith(word) || word.startsWith(candidate))) hits++;
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

function normalize(name) {
  const key = String(name).trim().toLowerCase();
  return SKILL_ALIASES[key] ?? key;
}

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
