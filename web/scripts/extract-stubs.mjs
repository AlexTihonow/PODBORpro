#!/usr/bin/env node
/**
 * Достаёт example-ответы из server/api/openapi.yaml и раскладывает их по файлам
 * src/api/stubs/<operationId>.<status>.json, а заодно генерирует:
 *   - manifest.ts — operationId -> { status -> импорт example }
 *   - routes.ts   — operationId -> { method, path }
 *
 * Так заглушки клиентской части и заглушки сервера всегда берутся из одного
 * описания REST-интерфейса (см. 04-klientskaya.md, раздел 3.2).
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const openapiPath = resolve(root, "../server/api/openapi.yaml");
const stubsDir = resolve(root, "src/api/stubs");

const METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const spec = parseYaml(readFileSync(openapiPath, "utf8"), { merge: true });

// Удаляем только сгенерированные файлы, чтобы не трогать рукописные
// index.ts, scenarios.ts, types.ts, которые живут в той же папке.
mkdirSync(stubsDir, { recursive: true });
for (const entry of readdirSync(stubsDir)) {
  if (entry === "manifest.ts" || entry === "routes.ts" || entry.endsWith(".json")) {
    rmSync(resolve(stubsDir, entry), { force: true });
  }
}

/** @type {{operationId: string, method: string, path: string}[]} */
const routes = [];
/** @type {Record<string, Record<string, string>>} operationId -> status -> имя файла */
const manifest = {};

for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!METHODS.has(method)) continue;
    const operationId = operation.operationId;
    if (!operationId) continue;

    routes.push({ operationId, method: method.toUpperCase(), path });

    const byStatus = {};
    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      const example = response?.content?.["application/json"]?.example;
      if (example === undefined) continue;
      const file = `${operationId}.${status}.json`;
      writeFileSync(resolve(stubsDir, file), `${JSON.stringify(example, null, 2)}\n`);
      byStatus[status] = file;
    }
    if (Object.keys(byStatus).length > 0) manifest[operationId] = byStatus;
  }
}

// manifest.ts
const imports = [];
const entries = [];
for (const [operationId, byStatus] of Object.entries(manifest)) {
  const statusEntries = [];
  for (const [status, file] of Object.entries(byStatus)) {
    const importName = `${sanitize(operationId)}_${status}`;
    imports.push(`import ${importName} from "./${file}";`);
    statusEntries.push(`${status}: ${importName}`);
  }
  entries.push(`${operationId}: { ${statusEntries.join(", ")} }`);
}

const manifestTs = [
  "// Сгенерировано scripts/extract-stubs.mjs — не править вручную.",
  ...imports,
  "",
  "export const stubMap = {",
  ...entries.map((e) => `  ${e},`),
  "} as const;",
  "",
].join("\n");
writeFileSync(resolve(stubsDir, "manifest.ts"), manifestTs);

// routes.ts
const routesTs = [
  "// Сгенерировано scripts/extract-stubs.mjs — не править вручную.",
  "export interface StubRoute {",
  "  operationId: string;",
  "  method: string;",
  "  path: string;",
  "}",
  "",
  `export const stubRoutes: StubRoute[] = ${JSON.stringify(routes, null, 2)};`,
  "",
].join("\n");
writeFileSync(resolve(stubsDir, "routes.ts"), routesTs);

const count = Object.values(manifest).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`extract-stubs: ${count} примеров, ${routes.length} адресов -> src/api/stubs/`);

function sanitize(value) {
  return value.replace(/[^a-zA-Z0-9_$]/g, "_");
}
