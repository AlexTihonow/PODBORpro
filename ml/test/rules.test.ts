import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeQuestion } from "../src/questions.ts";
import { gradesForExperience } from "../src/rules.ts";

test("experience maps to two neighbouring grades", () => {
  assert.deepEqual(gradesForExperience("не требуется"), ["intern", "junior"]);
  assert.deepEqual(gradesForExperience("1–3 года"), ["junior", "middle"]);
  assert.deepEqual(gradesForExperience("3–6 лет"), ["middle", "senior"]);
  assert.deepEqual(gradesForExperience("более 6 лет"), ["senior", "lead"]);
  assert.equal(gradesForExperience(""), null);
  assert.deepEqual(Object.keys(gradeQuestion(["middle", "senior"]).criteria), ["middle", "senior"]);
});
