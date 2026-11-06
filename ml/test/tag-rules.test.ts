import assert from "node:assert/strict";
import { test } from "node:test";
import { tagFromRules } from "../src/tag-rules.ts";

const cases: [string, string[], string[] | null][] = [
  ["Golang-разработчик", [], ["backend", "go"]],
  ["Go-разработчик, инструменты поддержки ФБС", [], ["backend", "go"]],
  ["Junior Backend разработчик Python", [], ["backend", "python"]],
  ["Разработчик бэкенд (middle)", ["Python", "FastAPI"], ["backend", "python"]],
  ["Senior Frontend-разработчик (React)", [], ["frontend", "react"]],
  ["Fullstack-разработчик (AI-native)", [], ["fullstack"]],
  ["Python-разработчик (с погружением в AI)", [], ["backend", "python"]],
  ["Разработчик ML", [], ["data", "science"]],
  ["Системный аналитик", [], ["analytics", "system"]],
  ["Manual Mobile QA (Retail, Middle)", [], ["qa", "manual"]],
  ["Инженер технической поддержки (2 линия)", [], ["support"]],
  ["Sub Lead Unity 3D Developer", ["Unity", "C#"], null],
];

for (const [title, skills, expected] of cases) {
  test(title, () => assert.deepEqual(tagFromRules(title, skills), expected));
}
