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

function fakeModel(script: Record<string, Answer>[]): Model & { asked: string[][] } {
  const asked: string[][] = [];
  return {
    asked,
    async systemOne(_state: unknown, questions: QuestionSet) {
      asked.push(Object.keys(questions));
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
    { path: "it/backend/go", label: "Backend / Go", confidence: 0.95, stopped: "leaf", source: "rule" },
  ]);
  assert.equal(result.answers.grade.value, "senior");
  assert.equal(result.answers.work_format.value, "remote");
  assert.equal(result.answers.english.value, true);
  assert.equal(result.needs_review, false);
});

test("rule picks the branch and Laya picks the leaf", async () => {
  const model = fakeModel([{ tag: choice("python", 0.8) }]);
  const result = await classify(model, {
    id: "hh:2",
    title: "Senior Backend Developer",
    text: "",
    work_format_raw: "гибрид",
    skills: [],
  });

  assert.deepEqual(model.asked, [["tag"]]);
  assert.equal(result.answers.tags[0].path, "it/backend/python");
  assert.equal(result.answers.tags[0].source, "laya");
});

test("model answers what rules cannot and low confidence asks for review", async () => {
  const model = fakeModel([
    { tag: choice("qa", 0.3), grade: choice("middle", 0.4), work_format: choice("office", 0.7), english: noul(0.2) },
  ]);
  const result = await classify(model, { id: "hh:3", title: "Специалист автоматизации", text: "Будет плюсом английский." });

  assert.deepEqual(model.asked, [["tag", "grade", "work_format", "english"]]);
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
