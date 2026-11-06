import { Laya } from "@receptron/laya";
import { modelRef } from "./model.ts";

const ref = modelRef();
let last = -1;
const laya = await Laya.load({
  repo: ref.repo,
  subfolder: ref.subfolder,
  revision: ref.revision,
  onProgress: ({ file, received, total }) => {
    const percent = total ? Math.round((received / total) * 100) : 0;
    if (percent !== last && percent % 10 === 0) console.log(`${file} ${percent}%`);
    last = percent;
  },
});
console.log(`ready: ${ref.id} in ${laya.modelDir}`);
await laya.close();
