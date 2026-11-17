// Разбор вакансии по дереву тегов без модели.
//
// 1. Текст нормализуется (normalize.ts), затем в трёх зонах — название, навыки
//    со страницы, текст — ищутся понятия из словаря (lexicon.ts). Совпадения не
//    перекрываются: побеждает более длинное («тестирование на проникновение»
//    съедает «тестирование», «1С-Битрикс» съедает «1С»).
// 2. Каждое совпадение добавляет баллы веткам дерева: вес понятия × вес зоны.
//    В названии слово, стоящее ближе к началу, весит чуть больше.
// 3. Дерево проходится сверху вниз. На каждом уровне ветка выбирается сама, если
//    у неё уверенный отрыв; несколько веток с сильными признаками в названии дают
//    несколько тегов; если признаков мало или ветки спорят — уровень отдаётся
//    Laya с английским описанием вакансии и сокращённым списком вариантов.

import { childrenAt } from "../tags.ts";
import { COMPILED, NON_IT } from "./lexicon.ts";
import { normalize, splitSkills } from "./normalize.ts";

export type Zone = "title" | "skills" | "text";

export const ZONE_WEIGHT: Record<Zone, number> = { title: 3, skills: 1.5, text: 0.5 };
const TITLE_POSITION_BONUS = 0.15;
const TITLE_CONTEXT_FACTOR = 0.5;

// Часть названия, которая описывает не роль, а контекст: всё после запятой или
// после «в команду / для отдела …». «Go-разработчик, команда SRE» — это Go-разработчик.
const TITLE_CONTEXT = /,|\s\|\s|(?<![\p{L}])(?:в|во|для|in|for)\s+(?:команд|отдел|направлени|проект|групп|стартап|team|squad)/u;

export const ROOT_MIN = 1.5; // минимум баллов, чтобы выбрать направление без модели
export const CHILD_MIN = 0.5; // минимум для выбора стека внутри направления
export const MARGIN = 1.5; // во сколько раз лидер должен опережать второе место
export const MULTI_SHARE = 0.75; // доля от лидера, при которой ветка идёт вторым тегом

export interface Hit {
  concept: string;
  zone: Zone;
  text: string;
  start: number;
}

export interface Scores {
  total: Map<string, number>;
  title: Map<string, number>;
  strong: Map<string, number>; // название + навыки: то, что написал сам работодатель
  // Направления, которые названы ролью в названии (см. Concept.tier). Если набор не
  // пуст, на первом уровне соревнуются только они.
  roles: Set<string>;
  // Роли названы в разных частях «А / Б» («Full-stack / AI-инженер»): это несколько
  // ролей сразу, и каждая получает свой тег.
  multiRole: boolean;
}

export interface Brief {
  title: string;
  skills: string[];
  mentions: string[];
}

export interface Analysis {
  hits: Hit[];
  scores: Scores;
  brief: Brief;
}

export interface VacancyInput {
  title: string;
  skills?: string[];
  text?: string;
}

const BY_ID = new Map(COMPILED.map((c) => [c.id, c]));
// Листья, которые бывают только признаками («AI-assisted»): их не выбирают как основной тег.
const PURE_LEAVES = new Set(COMPILED.filter((c) => c.pure).flatMap((c) => Object.keys(c.tags ?? {})));

interface Match {
  concept: string;
  start: number;
  end: number;
}

// Все совпадения всех понятий; из пересекающихся остаётся самое длинное.
export function findConcepts(text: string): Match[] {
  const all: Match[] = [];
  for (const concept of COMPILED) {
    for (const pattern of concept.patterns) {
      pattern.lastIndex = 0;
      for (const m of text.matchAll(pattern)) {
        if (m[0].length > 0) all.push({ concept: concept.id, start: m.index, end: m.index + m[0].length });
      }
    }
  }
  all.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken: Match[] = [];
  for (const m of all) {
    if (taken.some((t) => m.start < t.end && t.start < m.end)) continue;
    taken.push(m);
  }
  return taken.sort((a, b) => a.start - b.start);
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

export function analyze(input: VacancyInput): Analysis {
  const title = normalize(input.title);
  const skills = splitSkills(input.skills ?? []).map(normalize);
  const text = normalize(input.text ?? "");

  const scores: Scores = { total: new Map(), title: new Map(), strong: new Map(), roles: new Set(), multiRole: false };
  const contextAt = title.search(TITLE_CONTEXT);
  const roleHits: RoleHit[] = [];
  const hits: Hit[] = [];
  const counted = new Set<string>();

  const score = (zone: Zone, source: string, matches: Match[]) => {
    for (const m of matches) {
      hits.push({ concept: m.concept, zone, text: source.slice(m.start, m.end), start: m.start });
      // Понятие считается один раз на зону: десять упоминаний Python в тексте
      // не должны перевешивать одно слово в названии. В тексте засчитываются до двух
      // разных формулировок («ручное тестирование» и «тест-кейсы» — два довода).
      const phrase = source.slice(m.start, m.end);
      const seen = [...counted].filter((k) => k.startsWith(`${zone}:${m.concept}:`));
      if (seen.includes(`${zone}:${m.concept}:${phrase}`) || seen.length >= (zone === "text" ? 2 : 1)) continue;
      counted.add(`${zone}:${m.concept}:${phrase}`);
      const concept = BY_ID.get(m.concept)!;
      if (concept.pure) continue;
      // Контекст после запятой ослабляет только слова-роли: «Go-разработчик, команда SRE»
      // не делает вакансию DevOps, но «Старший .Net, Go разработчик» — это и .NET, и Go.
      const inRole = zone === "title" && (contextAt < 0 || m.start < contextAt || !concept.tier);
      const position = inRole
        ? 1 + TITLE_POSITION_BONUS * (1 - m.start / Math.max(source.length, 1))
        : zone === "title"
          ? TITLE_CONTEXT_FACTOR
          : 1;
      for (const [path, weight] of Object.entries(concept.tags ?? {})) {
        const value = weight * ZONE_WEIGHT[zone] * position;
        add(scores.total, path, value);
        if (inRole) add(scores.title, path, value);
        if (zone !== "text") add(scores.strong, path, value);
        if (inRole && concept.tier) {
          const { segment, paren } = titlePlace(source, m.start);
          roleHits.push({ domain: path.split("/")[0], tier: concept.tier, segment, paren, yields: concept.yieldsTo ?? [] });
        }
      }
    }
  };

  const titleMatches = findConcepts(title);
  score("title", title, titleMatches);
  const skillMatches = skills.map((skill) => findConcepts(skill));
  skills.forEach((skill, i) => score("skills", skill, skillMatches[i]));
  const textMatches = findConcepts(text);
  score("text", text, textMatches);
  scores.multiRole = pickRoles(roleHits, scores.roles);

  return {
    hits,
    scores,
    brief: {
      title: englishTitle(title, titleMatches),
      skills: englishSkills(skills, skillMatches),
      mentions: unique(textMatches.map((m) => BY_ID.get(m.concept)!).filter((c) => c.tags).map((c) => c.en)).slice(0, 12),
    },
  };
}

// Где в названии стоит слово: в какой части «А / Б» и внутри ли скобок.
function titlePlace(title: string, at: number): { segment: number; paren: boolean } {
  let depth = 0;
  let segment = 0;
  for (let i = 0; i < at; i++) {
    const ch = title[i];
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    else if (ch === "/" && depth === 0) segment++;
  }
  return { segment, paren: depth > 0 };
}

// В каждой части «А / Б» роль определяет слово высшего уровня («Full-stack / AI-инженер»
// — две роли). Скобки уточняют: их роли учитываются, только если вне скобок ролей нет
// («Python Developer (ML/AI)» — ML, а «Backend-разработчик (робототехника)» — backend).
interface RoleHit {
  domain: string;
  tier: number;
  segment: number;
  paren: boolean;
  yields: string[];
}

function pickRoles(all: RoleHit[], roles: Set<string>): boolean {
  const hits = all.filter((h) => !h.yields.some((d) => all.some((o) => o.domain === d)));
  const main = hits.filter((h) => !h.paren);
  const pool = main.length > 0 ? main : hits;
  const best = new Map<number, number>();
  for (const h of pool) best.set(h.segment, Math.max(best.get(h.segment) ?? 0, h.tier));
  const segments = new Set<number>();
  for (const h of pool) {
    if (h.tier !== best.get(h.segment)) continue;
    roles.add(h.domain);
    segments.add(h.segment);
  }
  if (roles.has("backend") && roles.has("frontend")) roles.add("fullstack");
  return segments.size > 1 && roles.size > 1;
}

// ——— Английское описание для Laya ———

const LATIN_WORD = /^[a-z0-9][a-z0-9+#.\-]*$/;

function englishTitle(title: string, matches: Match[]): string {
  const parts: string[] = [];
  let cursor = 0;
  const keepLatin = (chunk: string) => {
    for (const word of chunk.split(/[^\p{L}\p{N}+#.\-]+/u)) {
      const w = word.replace(/^[-.]+|[-.]+$/g, "");
      if (w && LATIN_WORD.test(w)) parts.push(w);
    }
  };
  for (const m of matches) {
    keepLatin(title.slice(cursor, m.start));
    parts.push(BY_ID.get(m.concept)!.en);
    cursor = m.end;
  }
  keepLatin(title.slice(cursor));
  return unique(parts).join(" ");
}

function englishSkills(skills: string[], matches: Match[][]): string[] {
  const out: string[] = [];
  skills.forEach((skill, i) => {
    const known = matches[i].map((m) => BY_ID.get(m.concept)!).filter((c) => c.tags);
    if (known.length > 0) out.push(...known.map((c) => c.en));
    else if (!/\p{Script=Cyrillic}/u.test(skill)) out.push(skill);
  });
  return unique(out);
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ——— Теги-признаки ———

// Пути тегов-признаков (Concept.attribute), найденных в вакансии: они добавляются
// к основному направлению, а не соревнуются с ним.
export function attributes(a: Analysis): string[][] {
  const out = new Map<string, string[]>();
  for (const hit of a.hits) {
    const concept = BY_ID.get(hit.concept)!;
    if (!concept.attribute || hit.zone === "text") continue;
    if (concept.attribute === "title" && hit.zone !== "title") continue;
    for (const path of Object.keys(concept.tags ?? {})) out.set(path, path.split("/"));
  }
  return [...out.values()];
}

// Убирает тег, если есть более глубокий тег той же ветки: it/ai + it/ai/llm → it/ai/llm.
export function dropAncestors(paths: string[]): string[] {
  const unique = [...new Set(paths)];
  return unique.filter((p) => !unique.some((q) => q !== p && q.startsWith(`${p}/`)));
}

// ——— Выбор веток ———

function own(map: Map<string, number>, path: string[]): number {
  return map.get(path.join("/")) ?? 0;
}

// Балл ветки = её собственные признаки + лучший из потомков.
export function branchScore(map: Map<string, number>, path: string[]): number {
  const children = childrenAt(path);
  const best = children ? Math.max(0, ...Object.keys(children).map((key) => branchScore(map, [...path, key]))) : 0;
  return own(map, path) + best;
}

export interface Candidate {
  key: string;
  score: number;
  title: number;
  strong: number;
}

export type Decision =
  | { kind: "pick"; picks: { key: string; confidence: number }[] }
  | { kind: "ask"; candidates: string[]; reason: "no_evidence" | "weak" | "close" }
  | { kind: "stop" } // глубже признаков нет: остаёмся на текущем уровне
  | { kind: "non_it" };

function candidates(a: Analysis, path: string[]): Candidate[] {
  const children = childrenAt(path);
  if (!children) return [];
  const list = Object.keys(children)
    .filter((key) => !PURE_LEAVES.has([...path, key].join("/")))
    .map((key) => {
    const p = [...path, key];
    return {
      key,
      score: branchScore(a.scores.total, p),
      title: branchScore(a.scores.title, p),
      strong: branchScore(a.scores.strong, p),
    };
  });
  if (path.length === 0) {
    synthesizeFullstack(list);
    // Роль высшего уровня в названии отсекает направления, подсказанные словами пониже.
    if (a.scores.roles.size > 0) {
      return list.filter((c) => a.scores.roles.has(c.key)).sort((x, y) => y.score - x.score);
    }
  }
  return list.sort((x, y) => y.score - x.score);
}

// Backend и frontend с сопоставимыми признаками — это fullstack,
// даже если слова «fullstack» в вакансии нет («Тимлид C#/.NET + Angular»).
function synthesizeFullstack(list: Candidate[]) {
  const get = (key: string) => list.find((c) => c.key === key)!;
  const back = get("backend");
  const front = get("frontend");
  const full = get("fullstack");
  // «Fullstack» в названии поглощает backend и frontend: «Full Stack PHP-разработчик»
  // — fullstack, а не backend/php.
  if (full.title >= ZONE_WEIGHT.title * 0.8) {
    const lead = [back, front].reduce((x, y) => (y.score > x.score ? y : x));
    full.score = Math.max(full.score, lead.score) + 0.25;
    full.title = Math.max(full.title, lead.title);
    back.score = Math.min(back.score, full.score / MARGIN);
    front.score = Math.min(front.score, full.score / MARGIN);
    return;
  }
  if (back.strong < 1 || front.strong < 1) return;
  if (Math.min(back.score, front.score) / Math.max(back.score, front.score) < 0.6) return;
  const lead = back.score >= front.score ? back : front;
  full.score = Math.max(full.score, lead.score + 0.25);
  full.title = Math.max(full.title, Math.min(back.title, front.title));
  full.strong = Math.max(full.strong, lead.strong);
}

function confidence(top: number, second: number, min: number): number {
  const margin = second > 0 ? 1 - second / top : 1;
  const strength = Math.min(1, top / (min * 2));
  return Math.round(Math.min(0.97, 0.55 + 0.42 * margin * strength) * 1000) / 1000;
}

export function decide(a: Analysis, path: string[]): Decision {
  const root = path.length === 0;
  const list = candidates(a, path);
  if (list.length === 0) return { kind: "stop" };

  if (root) {
    const nonIT = a.scores.title.get(NON_IT) ?? 0;
    const itInTitle = Math.max(0, ...list.map((c) => c.title));
    if (nonIT > 0 && nonIT >= itInTitle) return { kind: "non_it" };
  }

  const [top, second] = list;
  const all = list.map((c) => c.key);
  if (top.score === 0) return root ? { kind: "ask", candidates: all, reason: "no_evidence" } : { kind: "stop" };

  const min = root ? ROOT_MIN : CHILD_MIN;
  // Без признаков от работодателя (название, навыки) направление не выбираем сами:
  // в тексте упоминается слишком много чужих ролей («в команде аналитики и QA»).
  if (top.score < min || (root && top.strong === 0)) {
    return { kind: "ask", candidates: all, reason: "weak" };
  }

  // Внутри ветки одно упоминание в тексте — слабый повод: «CISO» с фразой про пентест
  // в описании остаётся просто «Безопасностью». Спорят несколько слабых — решает Laya.
  if (!root && top.strong === 0 && top.score < 1) {
    return second && second.score > 0 ? { kind: "ask", candidates: all, reason: "weak" } : { kind: "stop" };
  }

  const strongInTitle = (c: Candidate) => c.title >= ZONE_WEIGHT.title * 0.8;
  // Если лидер назван в названии, а соперник набрал баллы только навыками и текстом,
  // верим названию: работодатель сам написал, кого ищет.
  const close = list.filter(
    (c) => c !== top && c.score * MARGIN > top.score && !(strongInTitle(top) && !strongInTitle(c)),
  );
  const extra = list.filter(
    (c) => c !== top && c.title >= top.title * MULTI_SHARE && strongInTitle(c) && strongInTitle(top),
  );
  const unresolved = root && a.scores.multiRole ? [] : close.filter((c) => !extra.includes(c));

  if (unresolved.length > 0) {
    return { kind: "ask", candidates: [top, ...close].map((c) => c.key), reason: "close" };
  }

  const covered = top.key === "fullstack" ? new Set(["backend", "frontend"]) : new Set<string>();
  if (root && a.scores.multiRole) {
    for (const c of list) if (c !== top && c.score > 0 && !extra.includes(c)) extra.push(c);
  }
  const picks = [top, ...extra.filter((c) => !covered.has(c.key))];
  const runnerUp = list.find((c) => !picks.includes(c))?.score ?? 0;
  return { kind: "pick", picks: picks.map((c) => ({ key: c.key, confidence: confidence(c.score, runnerUp, min) })) };
}
