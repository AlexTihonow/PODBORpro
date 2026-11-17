import assert from "node:assert/strict";
import { test } from "node:test";
import type { Answer } from "@receptron/laya";
import { classify, type Model } from "../src/classify.ts";
import type { QuestionSet } from "../src/questions.ts";

function choice(value: string, confidence: number): Answer {
  return {
    type: "choice",
    choice: value,
    probabilities: { [value]: confidence },
    confidence,
    answer_confidence: confidence,
    rl_agent: { act_probability: 1 },
  };
}

function noul(value: number): Answer {
  return { type: "noul", noul: value, answer_confidence: Math.max(value, 1 - value), rl_agent: { act_probability: 1 } };
}

function fakeModel(script: Record<string, Answer>[]): Model & { asked: string[][]; states: unknown[]; criteria: string[][] } {
  const asked: string[][] = [];
  const states: unknown[] = [];
  const criteria: string[][] = [];
  return {
    asked,
    states,
    criteria,
    async systemOne(state: unknown, questions: QuestionSet) {
      asked.push(Object.keys(questions));
      states.push(state);
      const tag = questions.tag as { criteria?: Record<string, string> } | undefined;
      if (tag?.criteria) criteria.push(Object.keys(tag.criteria));
      return { answers: script[asked.length - 1] };
    },
  };
}

test("rules decide everything for a clear vacancy without calling the model", async () => {
  const model = fakeModel([]);
  const result = await classify(model, {
    id: "hh:1",
    title: "Senior Go-разработчик",
    text: "Требования: Go, английский B2",
    work_format_raw: "удалённо",
    skills: ["Go"],
  });

  assert.deepEqual(model.asked, []);
  assert.deepEqual(result.answers.tags, [
    { path: "it/backend/go", label: "Backend / Go", confidence: 0.97, stopped: "leaf", source: "rule" },
  ]);
  assert.equal(result.answers.grade.value, "senior");
  assert.equal(result.answers.work_format.value, "remote");
  assert.equal(result.answers.english.value, true);
  assert.equal(result.needs_review, false);
});

test("without any stack evidence the tag stops at the branch instead of guessing", async () => {
  const model = fakeModel([]);
  const result = await classify(model, {
    id: "hh:2",
    title: "Senior Backend Developer",
    text: "",
    work_format_raw: "гибрид",
    skills: [],
  });

  assert.deepEqual(model.asked, []);
  assert.deepEqual(result.answers.tags, [
    { path: "it/backend", label: "Backend", confidence: 0.97, stopped: "no_evidence", source: "rule" },
  ]);
});

test("close candidates go to Laya in English with a narrowed choice", async () => {
  const model = fakeModel([{ tag: choice("manual", 0.8) }]);
  const result = await classify(model, {
    id: "hh:5",
    title: "Старший тестировщик ПО",
    text: "Автотесты и тест-кейсы.",
    work_format_raw: "удалённо",
    skills: [],
  });

  assert.deepEqual(model.asked, [["tag"]]);
  assert.deepEqual(model.criteria, [["manual", "automation", "other"]]);
  const state = model.states[0] as { title: string; mentions: string };
  assert.match(state.title, /QA engineer/);
  assert.doesNotMatch(JSON.stringify(state), /\p{Script=Cyrillic}/u);
  assert.equal(result.answers.tags[0].path, "it/qa/manual");
  assert.equal(result.answers.tags[0].source, "laya");
});

test("model answers what rules cannot and low confidence asks for review", async () => {
  const model = fakeModel([
    { grade: choice("middle", 0.4), work_format: choice("office", 0.7), english: noul(0.2) },
    { tag: choice("qa", 0.3) },
  ]);
  const result = await classify(model, { id: "hh:3", title: "Специалист автоматизации", text: "Будет плюсом английский." });

  assert.deepEqual(model.asked, [["grade", "work_format", "english"], ["tag"]]);
  assert.deepEqual(result.answers.tags, []);
  assert.deepEqual(result.answers.grade, { value: "middle", confidence: 0.4, source: "laya" });
  assert.equal(result.answers.english.value, false);
  assert.equal(result.needs_review, true);
});

test("experience narrows grade options", async () => {
  const model = fakeModel([{ grade: choice("middle", 0.6) }]);
  const result = await classify(model, {
    id: "hh:4",
    title: "Инженер по автоматизации тестирования",
    text: "Автотесты на Python.",
    experience: "3–6 лет",
    work_format_raw: "на месте работодателя",
  });

  assert.deepEqual(model.asked, [["grade"]]);
  assert.equal(result.answers.tags[0].path, "it/qa/automation");
  assert.equal(result.answers.grade.value, "middle");
});
