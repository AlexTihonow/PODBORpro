import { notFound } from "../api/error.js";
import * as account from "./account.js";
import * as applications from "./applications.js";
import { findVacancy } from "./catalog.js";
import { buildFeed } from "./feed.js";
import * as letters from "./letters.js";
import { clone, delay } from "./util.js";

const routes = [
  ["POST", /^\/auth\/login$/, (ctx) => account.login(ctx.body)],
  ["POST", /^\/auth\/register$/, (ctx) => account.register(ctx.body)],
  ["GET", /^\/me$/, () => account.me()],
  ["PATCH", /^\/me$/, (ctx) => account.patchMe(ctx.body)],
  ["GET", /^\/health$/, () => ({ status: "ok", services: { db: "ok", ml: "ok" } })],
  ["GET", /^\/feed$/, (ctx) => buildFeed(account.currentProfile(), ctx.query.get("city"))],
  ["GET", /^\/vacancies\/(\d+)$/, (ctx) => vacancyDetails(ctx.id)],
  ["POST", /^\/vacancies\/(\d+)\/letters$/, (ctx) => createLetter(ctx.id)],
  ["GET", /^\/letters\/(\d+)$/, (ctx) => letters.getLetter(ctx.id)],
  ["PATCH", /^\/letters\/(\d+)$/, (ctx) => letters.patchLetter(ctx.id, ctx.body)],
  ["GET", /^\/letters\/(\d+)\/versions$/, (ctx) => letters.listVersions(ctx.id)],
  ["GET", /^\/applications$/, (ctx) => applications.listApplications(ctx.query)],
  ["PATCH", /^\/applications\/(\d+)$/, (ctx) => applications.patchApplication(ctx.id, ctx.body)],
];

export async function requestDemo(method, path, body) {
  await delay();
  const [pathname, queryString = ""] = path.split("?");
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  for (const [routeMethod, pattern, handler] of routes) {
    const match = method === routeMethod && cleanPath.match(pattern);
    if (match) {
      return handler({ id: Number(match[1]), body: body ?? {}, query: new URLSearchParams(queryString) });
    }
  }
  throw notFound();
}

async function vacancyDetails(id) {
  const vacancy = await findVacancy(id);
  return { ...clone(vacancy), also_on: [] };
}

async function createLetter(vacancyId) {
  const letter = await letters.createLetter(vacancyId, account.currentProfile());
  await applications.linkLetter(vacancyId, letter.id);
  return letter;
}
