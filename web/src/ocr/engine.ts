import type { Worker as TesseractWorker } from "tesseract.js";
import { ocrFiles, type OcrFile, type OcrFiles } from "./files";

/**
 * Tesseract.js in a worker, every file from the app's own origin (files.ts).
 *
 * The first read downloads about 4.8 MB: the worker, this device's core and
 * the Romanian data. The page fetches them itself, to count the bytes as they
 * come, and the service worker keeps what it fetches (sw.ts, cache-first), so
 * the Tesseract worker's own requests for the same files are answered from
 * that cache, and every later read works offline. Without a service worker in
 * control (the dev server, a first visit) Tesseract fetches them unaided and
 * there is no byte count.
 */

export type OcrStage =
  /** Downloading the reader, `loaded` of `total` bytes. */
  | { stage: "download"; loaded: number; total: number }
  /** Starting Tesseract; `downloading` is what it still fetches by itself, in bytes (0 from the cache). */
  | { stage: "start"; downloading: number }
  /** Reading the photo, 0 to 1. */
  | { stage: "read"; progress: number };

/** The reader couldn't load: offline before its first use, or a file missing. */
export class OcrLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OcrLoadError";
  }
}

async function isCached(url: string): Promise<boolean> {
  try {
    return (await caches.match(url)) !== undefined;
  } catch {
    // No Cache Storage (an insecure origin, a private window): count it as missing.
    return false;
  }
}

async function missing(files: OcrFiles): Promise<OcrFile[]> {
  const all = [files.worker, files.core, files.coreWasm, files.lang];
  const cached = await Promise.all(all.map((file) => isCached(file.url)));
  return all.filter((_, i) => !cached[i]);
}

/** What the first read still has to download, in bytes; 0 once the service worker has it all. */
export async function downloadSize(): Promise<number> {
  return (await missing(await ocrFiles())).reduce((sum, file) => sum + file.bytes, 0);
}

/** Fetches `files` through the service worker, which keeps them, reporting bytes as they arrive. */
async function download(files: OcrFile[], onProgress: (stage: OcrStage) => void): Promise<void> {
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  const report = () => onProgress({ stage: "download", loaded: Math.min(loaded, total), total });
  report();
  await Promise.all(
    files.map(async (file) => {
      let response: Response;
      try {
        response = await fetch(file.url);
      } catch (error) {
        throw new OcrLoadError("The text reader couldn't be downloaded.", { cause: error });
      }
      if (!response.ok || response.body === null) throw new OcrLoadError(`The text reader couldn't be downloaded (${response.status}).`);
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        report();
      }
    }),
  );
}

/** Tesseract's settings for a CIP block. */
const PARAMETERS = {
  // Sauvola's local thresholds: Otsu's one threshold for the page (the default)
  // loses the words under a shadow, as a phone photo of a page often has.
  thresholding_method: "2",
};

export interface OcrReader {
  /** The text in the image, line by line. Starts Tesseract on the first call; later calls reuse it. */
  read(image: HTMLCanvasElement, onProgress: (stage: OcrStage) => void): Promise<string>;
  /** Stops the worker. A read in progress fails; the next starts a new worker. */
  dispose(): void;
}

export function createOcrReader(): OcrReader {
  let worker: Promise<TesseractWorker> | null = null;
  let listener: ((stage: OcrStage) => void) | null = null;

  const start = async (): Promise<TesseractWorker> => {
    const files = await ocrFiles();
    const absent = await missing(files);
    const bytes = absent.reduce((sum, file) => sum + file.bytes, 0);
    const controlled = typeof navigator.serviceWorker !== "undefined" && navigator.serviceWorker.controller !== null;
    if (absent.length > 0 && controlled) await download(absent, (stage) => listener?.(stage));
    listener?.({ stage: "start", downloading: controlled ? 0 : bytes });

    const tesseract = await import("tesseract.js");
    const { createWorker } = tesseract.default ?? tesseract;
    // tesseract.js reports a failed language or initialisation only through
    // `errorHandler`; without it `createWorker` never settles.
    let fail: (error: Error) => void = () => {};
    const failed = new Promise<never>((_, reject) => (fail = reject));
    failed.catch(() => {});
    const created = createWorker("ron", 1 /* OEM.LSTM_ONLY */, {
      workerPath: files.worker.url,
      corePath: files.core.url,
      langPath: files.langPath,
      // A same-origin worker, not tesseract.js's blob: wrapper, so the core finds its .wasm beside it.
      workerBlobURL: false,
      // The service worker keeps the data; Tesseract's own IndexedDB copy would be a second one, unpacked.
      cacheMethod: "none",
      gzip: true,
      logger: (message) => {
        if (message.status === "recognizing text") listener?.({ stage: "read", progress: message.progress });
      },
      errorHandler: (error: unknown) => fail(new OcrLoadError(`The text reader failed: ${String(error)}`)),
    }).catch((error: unknown) => {
      throw new OcrLoadError("The text reader couldn't start.", { cause: error });
    });
    const ready = await Promise.race([created, failed]);
    await ready.setParameters(PARAMETERS);
    return ready;
  };

  return {
    async read(image, onProgress) {
      listener = onProgress;
      worker ??= start().catch((error: unknown) => {
        worker = null;
        throw error;
      });
      const ready = await worker;
      onProgress({ stage: "read", progress: 0 });
      const { data } = await ready.recognize(image);
      return data.text;
    },
    dispose() {
      listener = null;
      const current = worker;
      worker = null;
      void current?.then((ready) => ready.terminate()).catch(() => {});
    },
  };
}
