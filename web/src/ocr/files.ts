import { relaxedSimd, simd } from "wasm-feature-detect";
import { appBase } from "../base";

/**
 * The Tesseract files this build serves (vite.config.ts, `ocrAssets`): their
 * directories under the base path and their sizes, so the first read can say
 * how much it downloads before it starts.
 */
interface OcrManifest {
  engine: string;
  lang: string;
  bytes: { worker: number; cores: Record<CoreName, { js: number; wasm: number }>; ron: number };
}

declare const __SHELFMARK_OCR__: OcrManifest;

/** Tesseract's LSTM-only builds: relaxed SIMD (recent Chrome), SIMD (every current browser), plain. */
export type CoreName = "relaxedsimd-lstm" | "simd-lstm" | "lstm";

export interface OcrFile {
  url: string;
  bytes: number;
}

export interface OcrFiles {
  /** The worker script: loaded with `new Worker`, it loads the core with `importScripts`. */
  worker: OcrFile;
  /** The core's glue; its .wasm sits beside the worker under the same name. */
  core: OcrFile;
  coreWasm: OcrFile;
  /** `ron.traineddata.gz`, and the directory Tesseract is given as `langPath`. */
  lang: OcrFile;
  langPath: string;
}

/** The build the device runs fastest, the way tesseract.js would pick it from jsDelivr. */
async function pickCore(): Promise<CoreName> {
  if (await relaxedSimd()) return "relaxedsimd-lstm";
  if (await simd()) return "simd-lstm";
  return "lstm";
}

let picked: Promise<OcrFiles> | null = null;

/** Absolute URLs on the app's own origin, for this device's core. */
export function ocrFiles(): Promise<OcrFiles> {
  picked ??= pickCore().then((core) => {
    const at = (path: string) => new URL(`${appBase()}${path}`, location.href).href;
    const { engine, lang, bytes } = __SHELFMARK_OCR__;
    return {
      worker: { url: at(`${engine}worker.min.js`), bytes: bytes.worker },
      core: { url: at(`${engine}tesseract-core-${core}.js`), bytes: bytes.cores[core].js },
      coreWasm: { url: at(`${engine}tesseract-core-${core}.wasm`), bytes: bytes.cores[core].wasm },
      lang: { url: at(`${lang}ron.traineddata.gz`), bytes: bytes.ron },
      langPath: at(lang),
    };
  });
  return picked;
}
