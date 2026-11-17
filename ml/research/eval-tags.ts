// Прогон русского движка разметки по сохранённым вакансиям без модели.
//
//   node research/eval-tags.ts ../scraper/data/vacancies.json [--all]
//
// Показывает: сколько вакансий правила разметили сами, сколько отдали бы Laya
// (и с каким английским описанием), сколько признали не-IT, и сверяет выбранный
// стек с навыками со страницы вакансии (теги работодателя).

import { readFileSync } from "node:fs";
import { COMPILED } from "../src/ru/lexicon.ts";
import { analyze, attributes, decide, dropAncestors, findConcepts, type Analysis } from "../src/ru/engine.ts";
import { normalize, splitSkills } from "../src/ru/normalize.ts";
import { childrenAt } from "../src/tags.ts";

interface Stored {
  title: string;
  skills_raw?: string[];
  skills?: (string | { name: string })[];
  description?: string;
  tags?: { path: string }[] | null;
}

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const files = args.filter((a) => !a.startsWith("--"));

type Outcome = { tags: string[]; asks: { path: string; candidates: string[] }[]; nonIT: boolean };

function run(a: Analysis, path: string[] = []): Outcome {
  if (path.length > 0 && !childrenAt(path)) return { tags: [path.join("/")], asks: [], nonIT: false };
  const d = decide(a, path);
  if (d.kind === "non_it") return { tags: [], asks: [], nonIT: true };
  if (d.kind === "stop") return { tags: path.length ? [path.join("/")] : [], asks: [], nonIT: false };
  if (d.kind === "ask") {
    return { tags: path.length ? [path.join("/") + "?"] : [], asks: [{ path: path.join("/") || "it", candidates: d.candidates }], nonIT: false };
  }
  const out: Outcome = { tags: [], asks: [], nonIT: false };
  for (const pick of d.picks) {
    const sub = run(a, [...path, pick.key]);
    out.tags.push(...sub.tags);
    out.asks.push(...sub.asks);
  }
  return out;
}

const STACK = new Set(COMPILED.filter((c) => Object.keys(c.tags ?? {}).some((p) => p.includes("/"))).map((c) => c.id));
const stackLeaves = (id: string) => Object.keys(COMPILED.find((c) => c.id === id)!.tags!).filter((p) => p.includes("/"));

let total = 0;
let byRules = 0;
let partial = 0;
let toLaya = 0;
let nonIT = 0;
let multi = 0;
let checked = 0;
let agree = 0;
const disagreements: string[] = [];
const lines: string[] = [];

for (const file of files) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const items: Stored[] = Array.isArray(raw) ? raw : raw.vacancies ?? raw.items;
  for (const v of items) {
    total++;
    const skills = (v.skills_raw ?? v.skills ?? []).map((s) => (typeof s === "string" ? s : s.name));
    const a = analyze({ title: v.title, skills, text: (v.description ?? "").slice(0, 2400) });
    const o = run(a);
    if (!o.nonIT) o.tags = dropAncestors([...o.tags, ...attributes(a).map((p) => p.join("/"))]);
    if (o.nonIT) nonIT++;
    else if (o.asks.length === 0) byRules++;
    else if (o.tags.length > 0) partial++;
    else toLaya++;
    if (o.tags.length > 1) multi++;

    // Сверка со страницей: какие стеки работодатель указал в навыках.
    const pageStacks = new Set(
      splitSkills(skills)
        .flatMap((s) => findConcepts(normalize(s)))
        .filter((m) => STACK.has(m.concept))
        .flatMap((m) => stackLeaves(m.concept)),
    );
    const leaves = o.tags.filter((t) => !t.endsWith("?") && t.split("/").length === 2);
    const comparable = leaves.filter((t) => pageStacks.size > 0 && [...pageStacks].some((p) => p.split("/")[0] === t.split("/")[0]));
    for (const leaf of comparable) {
      checked++;
      if (pageStacks.has(leaf)) agree++;
      else disagreements.push(`  ${leaf.padEnd(22)} | ${v.title} | страница: ${[...pageStacks].join(", ")}`);
    }

    const old = (v.tags ?? []).map((t) => t.path.replace(/^it\//, "")).join(",");
    const now = o.nonIT ? "НЕ-IT" : o.tags.join(",") || "—";
    const ask = o.asks.map((x) => `Laya@${x.path}[${x.candidates.join("|")}]`).join(" ");
    if (showAll || old !== now.replace(/\?/g, "") || o.asks.length > 0) {
      lines.push(`${now.padEnd(32)} ${old ? `(было ${old})` : ""} | ${v.title}${ask ? `\n      → ${ask}  EN: ${JSON.stringify(a.brief)}` : ""}`);
    }
  }
}

console.log(lines.join("\n"));
const pct = (n: number) => `${n} (${((n / total) * 100).toFixed(1)}%)`;
console.log(`\nВсего: ${total}`);
console.log(`Правила разметили полностью: ${pct(byRules)}`);
console.log(`Правила выбрали направление, стек решает Laya: ${pct(partial)}`);
console.log(`Целиком решает Laya: ${pct(toLaya)}`);
console.log(`Не-IT: ${pct(nonIT)}`);
console.log(`Несколько тегов: ${pct(multi)}`);
console.log(`Стек совпал с навыками на странице: ${agree}/${checked}`);
if (disagreements.length) console.log(`Расхождения со страницей:\n${disagreements.join("\n")}`);
