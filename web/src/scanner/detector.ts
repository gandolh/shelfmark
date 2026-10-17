import { classifyBarcode, type BarcodeClass } from "@shelfmark/shared";
// Vite emits the reader's .wasm into the build under the base path (hashed name)
// and serves it from our own origin in dev. The ponyfill's default would fetch
// it from jsDelivr instead. The version must match the ZXing glue the ponyfill
// bundles; detector.test.ts checks the file's SHA-256 against it.
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { Sightings } from "./debounce";

/** What a book carries: the EAN-13 ISBN, older or foreign codes, store stickers. */
export const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;
export type Format = (typeof FORMATS)[number];

/** What the scanner emits. Add-ons never get this far. */
export type ScannedCode = Exclude<BarcodeClass, { kind: "addon" }>;

/** The part of a detection the scanner reads; native results and the ponyfill's both fit. */
export interface Detection {
  rawValue: string;
  format: string;
}

/** The slice of the Barcode Detection API used here. */
export interface Detector {
  detect(source: HTMLVideoElement): Promise<Detection[]>;
}

/** The `BarcodeDetector` class, native or ponyfilled. */
export interface DetectorClass {
  new (options: { formats: Format[] }): Detector;
  getSupportedFormats(): Promise<readonly string[]>;
}

/** `native` is the browser's own detector (Chrome on Android); `zxing` the WASM ponyfill. */
export type Engine = "native" | "zxing";

export interface EngineChoice {
  engine: Engine;
  detector: Detector;
}

/** Emscripten overrides that make the ponyfill load its .wasm from `wasmUrl`. */
export function zxingOverrides(wasmUrl: string = zxingWasmUrl): {
  locateFile: (path: string, prefix: string) => string;
} {
  return { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) };
}

// One overrides object for the session: the ponyfill caches its module per
// overrides (shallow-compared), and a new `locateFile` would load the .wasm again.
const OVERRIDES = zxingOverrides();

/**
 * Load the ponyfill, a separate chunk so Chrome on Android never downloads it,
 * and instantiate the WASM now: the fetch overlaps the camera prompt, and a
 * failed fetch (offline before the service worker has it) shows up here rather
 * than as every frame failing.
 */
export async function loadZxing(): Promise<DetectorClass> {
  const { BarcodeDetector, prepareZXingModule, purgeZXingModule } = await import("barcode-detector/ponyfill");
  try {
    await prepareZXingModule({ overrides: OVERRIDES, fireImmediately: true });
  } catch (err) {
    // The ponyfill caches the failed instance too; drop it so "Try again" refetches.
    purgeZXingModule();
    throw err;
  }
  return BarcodeDetector;
}

function nativeClass(scope: object): DetectorClass | null {
  const candidate: unknown = (scope as { BarcodeDetector?: unknown }).BarcodeDetector;
  if (typeof candidate !== "function") return null;
  const cls = candidate as Partial<DetectorClass>;
  return typeof cls.getSupportedFormats === "function" ? (candidate as DetectorClass) : null;
}

/**
 * The native `BarcodeDetector` when the browser has one that reads EAN-13 (an
 * ISBN), else the ponyfill. Desktop Chrome on Linux has the class but no
 * formats; Safari and Firefox have no class by default.
 */
export async function selectEngine(
  scope: object = globalThis,
  load: () => Promise<DetectorClass> = loadZxing,
): Promise<EngineChoice> {
  const Native = nativeClass(scope);
  if (Native !== null) {
    let supported: readonly string[] = [];
    try {
      supported = await Native.getSupportedFormats();
    } catch {
      // A detector that cannot even list its formats is no detector.
    }
    if (supported.includes("ean_13")) {
      // Asking the native class for a format it lacks throws, so ask for the overlap.
      const formats = FORMATS.filter((f) => supported.includes(f));
      return { engine: "native", detector: new Native({ formats }) };
    }
  }
  const Zxing = await load();
  return { engine: "zxing", detector: new Zxing({ formats: [...FORMATS] }) };
}

let shared: Promise<EngineChoice> | undefined;

/** The session's detector, chosen once; a failed load is retried on the next call. */
export function getEngine(): Promise<EngineChoice> {
  shared ??= selectEngine().catch((err: unknown) => {
    shared = undefined;
    throw err;
  });
  return shared;
}

function keyOf(code: ScannedCode): string {
  return code.kind === "isbn" ? `isbn:${code.isbn13}` : `other:${code.code}`;
}

/**
 * One read's detections to the codes that fire now: each raw value is
 * classified with its format, add-ons are dropped, and `sightings` decides
 * (two reads must agree; a code that fired stays quiet while in view).
 */
export function codesFrom(
  detections: readonly Detection[],
  sightings: Sightings,
  now: number = Date.now(),
): ScannedCode[] {
  const codes = new Map<string, ScannedCode>();
  for (const { rawValue, format } of detections) {
    if (rawValue.trim() === "") continue;
    const code = classifyBarcode(rawValue, format);
    if (code.kind !== "addon") codes.set(keyOf(code), code);
  }
  return sightings.read([...codes.keys()], now).map((key) => codes.get(key)!);
}

/**
 * How often to read, from one read's start to the next's. Looking for a book,
 * often enough that a code reads at once. While a result is open, once a
 * second, only to notice the owner has moved to another book. After a read
 * that saw a code still waiting for its second read, again soon, so the
 * confirmation adds little to either.
 */
export const PACE = { search: 250, watch: 1000, confirm: 150 } as const;

export function readInterval(watching: boolean, pending: boolean): number {
  if (pending) return PACE.confirm;
  return watching ? PACE.watch : PACE.search;
}

/**
 * Run `detect` until the returned stop function is called, waiting
 * `interval()` from one read's start to the next's (asked after each read).
 * A slow frame delays the next one instead of overlapping it, and a failed
 * frame (the video between states) is skipped, not fatal.
 */
export function startDetectLoop(options: {
  detect: () => Promise<readonly Detection[]>;
  onDetections: (detections: readonly Detection[]) => void;
  interval: () => number;
}): () => void {
  const { detect, onDetections, interval } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    const started = Date.now();
    try {
      const detections = await detect();
      if (stopped) return;
      if (detections.length > 0) onDetections(detections);
    } catch {
      // One bad frame says nothing about the next.
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), Math.max(0, interval() - (Date.now() - started)));
  };

  // The first frame goes at once, so a code already under the camera reads instantly.
  timer = setTimeout(() => void tick(), 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
