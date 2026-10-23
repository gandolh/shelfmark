/**
 * Reads every photo in this folder the way the app does (engine.ts: the `ron`
 * best_int data, LSTM only, Sauvola thresholds) and writes what Tesseract read
 * beside it as `<name>.txt`, for block.test.ts. Run it from the repo root after
 * adding or replacing a photo, then set the photo's expected fields in the test:
 *
 *     node web/src/ocr/fixtures/record.ts
 *
 * It reads the data from node_modules, so nothing is downloaded.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";

const here = dirname(fileURLToPath(import.meta.url));
const langPath = dirname(createRequire(import.meta.url).resolve("@tesseract.js-data/ron/4.0.0_best_int/ron.traineddata.gz"));

const worker = await createWorker("ron", 1, { langPath, cacheMethod: "none", gzip: true });
await worker.setParameters({ thresholding_method: "2" });
for (const name of readdirSync(here).filter((file) => /\.(jpe?g|png)$/i.test(file))) {
  const { data } = await worker.recognize(readFileSync(join(here, name)));
  writeFileSync(join(here, name.replace(/\.\w+$/, ".txt")), data.text);
  console.log(`${name}: ${data.text.split("\n").length} lines, confidence ${data.confidence}`);
}
await worker.terminate();
