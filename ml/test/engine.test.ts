import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, attributes, decide, dropAncestors } from "../src/ru/engine.ts";
import { normalize } from "../src/ru/normalize.ts";
import { childrenAt } from "../src/tags.ts";

// Разметка одними правилами: пути выбранных тегов, «?» — уровень, который ушёл бы
// в Laya, «non-it» — не-IT вакансия.
function tags(title: string, skills: string[] = [], text = ""): string[] {
  const a = analyze({ title, skills, text });
  const walk = (path: string[]): string[] => {
    if (path.length > 0 && !childrenAt(path)) return [path.join("/")];
    const d = decide(a, path);
    if (d.kind === "non_it") return ["non-it"];
    if (d.kind === "stop") return [path.join("/")];
    if (d.kind === "ask") return [[...path, "?"].join("/")];
    return d.picks.flatMap((p) => walk([...path, p.key]));
  };
  return walk([]);
}

test("normalize: невидимые символы, двойники букв, ё, тире", () => {
  assert.equal(normalize("Product ​​Marketing Mana​ger"), "product marketing manager");
  assert.equal(normalize("Вackend – разработчик"), "backend - разработчик");
  assert.equal(normalize("Тестирoвщик"), "тестировщик");
  assert.equal(normalize("Стажёр"), "стажер");
});

const cases: [title: string, skills: string[], expected: string[]][] = [
  // старые случаи
  ["Golang-разработчик", [], ["backend/go"]],
  ["Go-разработчик, инструменты поддержки ФБС", [], ["backend/go"]],
  ["Junior Backend разработчик Python", [], ["backend/python"]],
  ["Разработчик бэкенд (middle)", ["Python", "FastAPI"], ["backend/python"]],
  ["Senior Frontend-разработчик (React)", [], ["frontend/react"]],
  ["Fullstack-разработчик (AI-native)", [], ["fullstack"]],
  ["Python-разработчик (с погружением в AI)", [], ["backend/python"]],
  ["Разработчик ML", [], ["ai/ml"]],
  ["Системный аналитик", [], ["analytics"]],
  ["Manual Mobile QA (Retail, Middle)", [], ["qa/manual"]],
  ["Инженер технической поддержки (2 линия)", [], ["support"]],
  ["Sub Lead Unity 3D Developer", ["Unity", "C#"], ["gamedev"]],

  // кириллица и границы слов
  ["Программист/Ведущий программист 1С 8.2 -8.3 1, ERP", [], ["backend/onec"]],
  ["Программист 1С-Битрикс на FoodTech проект", [], ["backend/php"]],
  ["AQA-инженер", ["Golang", "Kubernetes"], ["qa/automation"]],
  ["DevSecOps-инженер (SOC)", [], ["security"]],
  ["Вackend - разработчик (СТРОГО ОФИС)", ["PHP"], ["backend/php"]],
  ["Product ​Marketing Mana​ger", [], ["non-it"]],

  // роль важнее инструмента
  ["Senior Python Developer (ML/AI)", ["Python", "SQL"], ["ai/ml"]],
  ["Mobile QA Engineer (iOS/Android)", [], ["qa"]],
  ["Специалист по тестированию на проникновение", [], ["security"]],
  ["Тимлид разработки (C#/.NET + Angular)", [], ["fullstack", "management"]],
  ["Senior Full Stack PHP-разработчик", [], ["fullstack"]],
  ["Middle Golang-разработчик в команду SRE", [], ["backend/go"]],
  ["Backend-разработчик (робототехника)", ["Go"], ["backend/go"]],

  // несколько тегов
  ["PHP-разработчик (Go) Middle", [], ["backend/php", "backend/go"]],
  ["Старший .Net, Go разработчик", [], ["backend/dotnet", "backend/go"]],
  ["Full-stack / AI-инженер", [], ["fullstack", "ai"]],
  ["Стажёр DevOps / AI-инженер", [], ["devops", "ai"]],

  // недостающие раньше ветки и не-IT
  ["Ведущий технический писатель", [], ["docs"]],
  ["Директор по кибербезопасности (CISO)", [], ["security"]],
  ["Embedded Linux / OpenWrt инженер", [], ["embedded"]],
  ["Руководитель группы разработки", [], ["management"]],
  ["Менеджер по подбору и адаптации персонала (HRG)", [], ["non-it"]],
  ["Менеджер по планированию закупок и запасов", [], ["non-it"]],
  ["Junior Business Development & Sales Manager", [], ["non-it"]],

  // свежая проверочная выборка: аналитик уступает безопасности, роли через «/»
  ["Ведущий аналитик экспертной линии (SOC)", ["SIEM"], ["security"]],
  ["Application Security Аналитик", ["OWASP"], ["security"]],
  ["Архитектор сетевой безопасности", ["BGP"], ["security"]],
  ["Python Backend / AI Engineer", ["Python", "Django"], ["backend/python", "ai"]],
  ["Middle Auto/Manual QA", ["Python"], ["qa/automation", "qa/manual"]],
  ["Senior/Lead Fullstack QA (Java, ручное)", ["Java"], ["qa/manual"]],
  ["Middle/Senior QA Engineer (Manual/Auto)", [], ["qa/manual", "qa/automation"]],

  // базы данных и low-code
  ["PL/pgSQL разработчик", ["PostgreSQL"], ["database"]],
  ["Администратор базы данных ClickHouse", ["ClickHouse", "SQL"], ["database"]],
  ["Разработчик ELMA365", ["JavaScript", "TypeScript"], ["lowcode"]],
  ["Pega Developer", ["Java"], ["lowcode"]],
  ["Разработчик АБС rstyle", ["SQL"], ["lowcode"]],

  // понятия, которых не хватало
  ["Technical Manager", ["Python"], ["management"]],
  ["Руководитель IT проектов B2G", [], ["management"]],
  ["Linux Kernel Developer / Инженер-программист", ["C"], ["embedded"]],
  ["Консультант Qlikview", ["QlikView"], ["analytics"]],

  // без признаков стека не угадываем, а останавливаемся на ветке
  ["Senior Backend Developer", [], ["backend"]],
];

for (const [title, skills, expected] of cases) {
  test(title, () => assert.deepEqual(tags(title, skills), expected));
}

test("признаки в тексте решают спор, а не название", () => {
  assert.deepEqual(tags("QA Engineer", [], "Составление тест-кейсов, ручное тестирование веб-приложений."), ["qa/manual"]);
  assert.deepEqual(tags("QA Engineer", [], "Тест-кейсы и автотесты."), ["qa/?"]);
  assert.deepEqual(tags("QA Engineer", [], "Тест-кейсы, автотесты на Playwright."), ["qa/automation"]);
  // одно упоминание в тексте — не довод: CISO не становится пентестером
  assert.deepEqual(tags("Директор по кибербезопасности (CISO)", [], "Организация пентестов."), ["security"]);
});

// AI: основные теги и теги-признаки (как в classify: признаки добавляются к основным).
function withAttributes(title: string, skills: string[] = [], text = ""): string[] {
  const a = analyze({ title, skills, text });
  const base = tags(title, skills, text).filter((t) => t !== "non-it" && !t.endsWith("?"));
  return dropAncestors([...base, ...attributes(a).map((p) => p.join("/"))]);
}

const aiCases: [title: string, skills: string[], expected: string[]][] = [
  ["Senior AI Engineer – LLM-приложения, RAG и агенты", [], ["ai/llm"]],
  ["ИИ-инженер / AI Engineer middle+/senior (LLM-агенты)", [], ["ai/llm"]],
  ["AI-инженер", ["LangChain", "Python"], ["ai/llm"]],
  ["Инженер по внедрению ИИ", [], ["ai/integration"]],
  ["Начинающий Fullstack-разработчик (автоматизация и внедрение ИИ)", [], ["fullstack", "ai/integration"]],
  ["Product Manager AI автоматизация", [], ["management", "ai/integration"]],
  ["Разработчик чат-ботов на Python", [], ["backend/python", "ai/integration"]],
  ["AI-first Full-stack Developer — FinTech", [], ["fullstack", "ai/assisted"]],
  ["Senior Backend Developer (Python)", ["Python", "Claude Code"], ["backend/python", "ai/assisted"]],
  ["Backend разработчик AI моделей (LangChain, LangGraph, Python)", [], ["backend/python", "ai/llm"]],
  ["Senior Python Developer (ML/AI)", [], ["ai/ml"]],
  ["Программист по компьютерному зрению (CV / ML Engineer)", [], ["ai/ml"]],
  ["Ведущий CV / AI разработчик (чертежи, Python)", [], ["ai/ml"]],
];

for (const [title, skills, expected] of aiCases) {
  test(`AI: ${title}`, () => assert.deepEqual(withAttributes(title, skills), expected));
}

test("«AI-first» не выбирает направление сам, а только добавляется признаком", () => {
  assert.deepEqual(tags("Вайбкод-разработчик"), ["?"]);
  assert.deepEqual(withAttributes("Вайбкод-разработчик"), ["ai/assisted"]);
});

test("английское описание для Laya не содержит кириллицы", () => {
  const { brief } = analyze({
    title: "Ведущий инженер по тестированию, Big Promo",
    skills: ["Ручное тестирование", "Postman", "Тестирование API"],
    text: "Составление тест-кейсов, автотесты на Python.",
  });
  assert.equal(brief.title, "senior QA engineer big promo");
  assert.deepEqual(brief.skills, ["manual testing, test cases", "postman", "QA engineer"]);
  assert.ok(brief.mentions.includes("test automation, autotests"));
  assert.doesNotMatch(JSON.stringify(brief), /\p{Script=Cyrillic}/u);
});
