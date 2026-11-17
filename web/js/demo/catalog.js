import { notFound } from "../api/error.js";

const CATALOG_URL = "data/vacancies.json";

let catalog = null;

export function loadCatalog() {
  catalog ??= fetch(CATALOG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`catalog ${response.status}`);
      return response.json();
    })
    .then(normalizeCatalog)
    .catch(() => ({ generated_at: null, model: null, items: [] }));
  return catalog;
}

export async function listVacancies() {
  return (await loadCatalog()).items;
}

export async function findVacancy(id) {
  const vacancy = (await listVacancies()).find((item) => item.id === Number(id));
  if (!vacancy) throw notFound("Вакансия не найдена");
  return vacancy;
}

export function toCard(vacancy) {
  const { description, tags, labels, needs_review, ...card } = vacancy;
  return card;
}

// The scraper sometimes stores a whole bullet list as one "skill"
// ("• Golang • PostgreSQL • Kafka") and keeps "•" markers in descriptions.
// Clean both once on load so every page sees plain skill names and text.
export const SKILL_ALIASES = {
  golang: "go",
  postgres: "postgresql",
  "postgre sql": "postgresql",
  js: "javascript",
  ts: "typescript",
  k8s: "kubernetes",
  "node.js": "nodejs",
  node: "nodejs",
};

export function skillKey(name) {
  const key = String(name).trim().toLowerCase();
  return SKILL_ALIASES[key] ?? key;
}

const LIST_SEPARATORS = /\s*[•·▪●;\n]\s*/;
const MAX_SKILL_LENGTH = 40;

function normalizeCatalog(catalog) {
  const ids = new Map();
  const idFor = (name) => {
    const key = name.toLowerCase();
    if (!ids.has(key)) ids.set(key, ids.size + 1);
    return ids.get(key);
  };
  for (const vacancy of catalog.items ?? []) {
    const seen = new Set();
    vacancy.skills = vacancy.skills
      .flatMap((skill) => splitSkill(skill.name))
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name) => ({ id: idFor(name), name }));
    vacancy.description = stripBullets(vacancy.description);
  }
  return catalog;
}

function splitSkill(raw) {
  return String(raw ?? "")
    .split(LIST_SEPARATORS)
    .flatMap(splitOutsideParens)
    .map((part) =>
      part
        .replace(/^[^:()]{1,20}:\s+/, "") // "Monitoring: Sentry" -> "Sentry"
        .replace(/^[\s\-–—*.,]+|[\s\-–—*.,]+$/g, ""),
    )
    .filter((part) => part.length > 0 && part.length <= MAX_SKILL_LENGTH);
}

// Split "Python, FastAPI, Kafka" on commas, but keep "Vue.js (Composition API, Pinia)" whole.
function splitOutsideParens(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function stripBullets(text) {
  return String(text ?? "")
    .replace(/[ \t]*[•·▪●][ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function listSkillNames() {
  const counts = new Map();
  for (const vacancy of await listVacancies()) {
    for (const { name } of vacancy.skills) {
      const key = skillKey(name);
      // Prefer the spelling seen most often for a key ("Go" vs "Golang" vs "golang").
      const entry = counts.get(key) ?? { name, count: 0, spellings: new Map() };
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      entry.count++;
      counts.set(key, entry);
    }
  }
  for (const entry of counts.values()) {
    entry.name = [...entry.spellings].sort((a, b) => b[1] - a[1])[0][0];
    delete entry.spellings;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
}

const TAG_ROOT = "it";
const TREE_SKILLS_SHOWN = 12;

// The tag tree as the ml service labels it ("it/backend/go" → Backend → Go), built from
// the catalog. Each node knows how many vacancies sit under it and which skills they ask for
// most often, so the onboarding picker can go direction → subdirection → skills.
export async function listTagTree() {
  const root = { path: TAG_ROOT, label: "", count: 0, children: [], skills: [] };
  const nodes = new Map([[TAG_ROOT, root]]);
  const skillCounts = new Map();

  const vacancies = await listVacancies();
  // Full labels ("Data / ML / Data Science") as ml sent them; a label part may itself
  // contain " / ", so a node's own name is its full label minus its parent's.
  const fullLabels = new Map();
  for (const vacancy of vacancies) {
    for (const tag of vacancy.tags ?? []) if (tag.path && tag.label) fullLabels.set(tag.path, tag.label);
  }
  const fullLabelOf = (path, hint) => {
    if (fullLabels.has(path)) return fullLabels.get(path);
    const depth = path.split("/").length - 1;
    return String(hint ?? "").split(" / ").slice(0, depth).join(" / ");
  };

  const nodeFor = (path, hint) => {
    if (nodes.has(path)) return nodes.get(path);
    const parentPath = path.slice(0, path.lastIndexOf("/"));
    const full = fullLabelOf(path, hint);
    const parent = nodeFor(parentPath, full);
    const parentFull = parent === root ? "" : fullLabelOf(parentPath, full);
    const own = parentFull && full.startsWith(`${parentFull} / `) ? full.slice(parentFull.length + 3) : full.split(" / ").at(-1);
    const node = { path, label: own || path.split("/").at(-1), count: 0, children: [], skills: [] };
    parent.children.push(node);
    nodes.set(path, node);
    return node;
  };

  for (const vacancy of vacancies) {
    // A vacancy counts once per node even when several of its tags share an ancestor.
    const under = new Set();
    for (const tag of vacancy.tags ?? []) {
      if (!tag.path?.startsWith(`${TAG_ROOT}/`)) continue;
      nodeFor(tag.path, tag.label);
      for (let path = tag.path; path.includes("/"); path = path.slice(0, path.lastIndexOf("/"))) under.add(path);
    }
    for (const path of under) {
      nodes.get(path).count++;
      const counts = skillCounts.get(path) ?? new Map();
      for (const { name } of vacancy.skills) {
        const key = skillKey(name);
        const entry = counts.get(key) ?? { name, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
      skillCounts.set(path, counts);
    }
  }

  for (const node of nodes.values()) {
    node.children.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
    node.skills = [...(skillCounts.get(node.path)?.values() ?? [])]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"))
      .slice(0, TREE_SKILLS_SHOWN)
      .map((entry) => entry.name);
  }
  return root.children;
}

// True when a vacancy tag lies under one of the chosen paths ("it/backend" covers "it/backend/go").
export function tagMatches(vacancyTags, chosen) {
  if (!chosen?.length) return false;
  return (vacancyTags ?? []).some((tag) =>
    chosen.some((path) => tag.path === path || tag.path?.startsWith(`${path}/`)),
  );
}
