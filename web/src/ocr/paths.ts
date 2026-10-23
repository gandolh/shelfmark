/**
 * Where Tesseract's files live under the app's base path, for the page and the
 * service worker alike: `ocr/tesseract-<hash>/` (the worker script and the
 * cores) and `ocr/ron-<hash>/` (the Romanian data), copied there by
 * vite.config.ts. No DOM here: sw.ts imports it.
 */

export const OCR_DIR = "ocr/";

/**
 * The service worker's runtime cache for them, filled on the first read. A
 * device fetches four files (the worker, one core's .js and .wasm, the data),
 * so four entries: after an upgrade the new directory's files push the old
 * ones out.
 */
export const OCR_CACHE = { name: "shelfmark-ocr", maxEntries: 4 } as const;

/** True for a path under `<base>ocr/`. */
export function isOcrPath(pathname: string, base: string): boolean {
  return pathname.startsWith(`${base}${OCR_DIR}`);
}
