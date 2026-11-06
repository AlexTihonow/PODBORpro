import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Laya } from "@receptron/laya";

const REVISION_FILE = new URL("../laya.revision", import.meta.url);
const BUNDLE_FILES = ["laya.onnx", "laya.onnx.data", "laya_config.json", "tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json"];

export interface ModelRef {
  repo: string;
  subfolder: string;
  revision: string;
  id: string;
}

export function modelRef(): ModelRef {
  const [repo, subfolder, revision] = readFileSync(REVISION_FILE, "utf8").trim().split(/\s+/);
  return { repo, subfolder, revision, id: `${repo}@${revision.slice(0, 7)}/${subfolder}` };
}

export function cachedBundle(ref: ModelRef): string | null {
  const root = process.env.LAYA_CACHE ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "receptron-laya");
  const dir = join(root, ref.repo.replace("/", "--"), ref.revision, ref.subfolder);
  return BUNDLE_FILES.every((file) => existsSync(join(dir, file))) ? dir : null;
}

export function loadLaya(ref: ModelRef, onProgress?: (percent: number) => void): Promise<Laya> {
  return Laya.load({
    repo: ref.repo,
    subfolder: ref.subfolder,
    revision: ref.revision,
    modelDir: process.env.LAYA_MODEL_DIR || cachedBundle(ref) || undefined,
    onProgress: ({ received, total }) => {
      if (onProgress && total) onProgress(Math.round((received / total) * 100));
    },
  });
}
