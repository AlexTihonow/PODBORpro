import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { classify, type Model } from "./classify.ts";
import { loadLaya, modelRef } from "./model.ts";
import type { VacancyItem } from "./types.ts";

const PORT = Number(process.env.PORT || 8000);
const MAX_ITEMS = 32;
const MAX_BODY = 4 << 20;

const ref = modelRef();
let model: Model | null = null;
let loadError: string | null = null;

loadLaya(ref, (percent) => console.log(`download ${percent}%`))
  .then((laya) => {
    model = laya;
    console.log(`model ready: ${ref.id}`);
  })
  .catch((error: Error) => {
    loadError = error.message;
    console.error(`model failed: ${error.message}`);
  });

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return health(res);
    if (req.method === "POST" && req.url === "/classify") return await classifyBatch(req, res);
    send(res, 404, error("not_found", "Нет такого адреса"));
  } catch (err) {
    send(res, 500, error("internal", (err as Error).message));
  }
});

server.listen(PORT, () => console.log(`ml: http://localhost:${PORT}`));

function health(res: ServerResponse) {
  if (model) return send(res, 200, { status: "ok", model: ref.id, revision: ref.revision });
  send(res, 503, { status: loadError ? "error" : "loading", model: null, revision: ref.revision, error: loadError });
}

async function classifyBatch(req: IncomingMessage, res: ServerResponse) {
  if (!model) return send(res, 503, error("model_unavailable", loadError ?? "Модель загружается"));

  const body = await readJson(req);
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS || !items.every(isItem)) {
    return send(res, 400, error("validation_error", `Нужен список items от 1 до ${MAX_ITEMS} вакансий с id, title и text`));
  }

  const results = [];
  for (const item of items) results.push(await classify(model, item));
  send(res, 200, { model: ref.id, items: results });
}

function isItem(value: unknown): value is VacancyItem {
  const item = value as VacancyItem;
  return typeof item?.id === "string" && typeof item.title === "string" && typeof item.text === "string";
}

async function readJson(req: IncomingMessage): Promise<{ items?: unknown } | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function error(code: string, message: string) {
  return { error: { code, message } };
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
