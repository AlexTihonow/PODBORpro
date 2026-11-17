// Приводит русский текст вакансии к виду, на котором шаблоны работают одинаково:
// без невидимых символов, без латинских «двойников» внутри кириллических слов
// (и наоборот), в нижнем регистре, с «е» вместо «ё» и обычными дефисами.

const INVISIBLE = /[­​-‏‪-‮⁠-⁤﻿]/g;
const DASHES = /[‐-―−]/g;

const CYR_TO_LAT: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y",
  а: "a", е: "e", к: "k", о: "o", р: "p", с: "c", у: "y", х: "x",
};
const LAT_TO_CYR: Record<string, string> = Object.fromEntries(
  Object.entries(CYR_TO_LAT).map(([cyr, lat]) => [lat, cyr]),
);

const CYR = /\p{Script=Cyrillic}/u;
const LAT = /\p{Script=Latin}/u;
const WORD = /[\p{L}\p{N}]+/gu;

// В слове из смеси алфавитов заменяет буквы меньшинства на похожие буквы большинства:
// «Вackend» (первая «В» кириллическая) → «Backend», «тестирoвщик» → «тестировщик».
export function fixHomoglyphs(text: string): string {
  return text.replace(WORD, (word) => {
    let cyr = 0;
    let lat = 0;
    for (const ch of word) {
      if (CYR.test(ch)) cyr++;
      else if (LAT.test(ch)) lat++;
    }
    if (cyr === 0 || lat === 0) return word;
    const map = lat >= cyr ? CYR_TO_LAT : LAT_TO_CYR;
    const fixed = [...word].map((ch) => map[ch] ?? ch).join("");
    return fixed;
  });
}

export function normalize(text: string): string {
  return fixHomoglyphs(text.normalize("NFKC").replace(INVISIBLE, ""))
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(DASHES, "-")
    .replace(/[ \t ]+/g, " ")
    .trim();
}

// Навыки со страницы иногда приходят одной строкой: «• Golang • PostgreSQL • Kafka».
export function splitSkills(skills: string[]): string[] {
  return skills
    .flatMap((skill) => skill.split(/\s*[•·;|]\s*/))
    .map((skill) => skill.trim())
    .filter(Boolean);
}
