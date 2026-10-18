import { classifyBarcode, type BarcodeClass } from "@shelfmark/shared";
// Vite emits the reader's .wasm into the build under the base path (hashed name)
// and serves it from our own origin in dev. The ponyfill's default would fetch
// it from jsDelivr instead. The version must match the ZXing glue the ponyfill
// bundles; detector.test.ts checks the file's SHA-256 against it.
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

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
 * One read's detections as codes: each raw value is classified with its
 * format, add-ons are dropped, and a code seen twice in the frame is one.
 */
export function codesFrom(detections: readonly Detection[]): ScannedCode[] {
  const codes = new Map<string, ScannedCode>();
  for (const { rawValue, format } of detections) {
    if (rawValue.trim() === "") continue;
    const code = classifyBarcode(rawValue, format);
    if (code.kind !== "addon") codes.set(keyOf(code), code);
  }
  return [...codes.values()];
}

/** A press reads this often until a code is read. */
export const READ_EVERY_MS = 150;
/** How long a press keeps reading before it says nothing was read. */
export const READ_FOR_MS = 3000;
/** A sticker read first waits this long for an ISBN beside it: two more reads, with room for their decode time. */
export const ISBN_GRACE_MS = 450;

/** One press's reading. `result` is the code, or `null` when nothing was read in time. */
export interface Reading {
  result: Promise<ScannedCode | null>;
  /** Stop now: `result` rejects with an `AbortError` (the camera stopped, the page moved on). */
  cancel(): void;
}

/**
 * Read until a code is read, for at most `forMs`. The first ISBN ends the
 * reading: the owner sees it, and presses again if it looks wrong. A barcode
 * that isn't one (a store sticker) waits `graceMs` for an ISBN beside it,
 * then counts.
 */
export function readCode(
  detect: () => Promise<readonly Detection[]>,
  { everyMs = READ_EVERY_MS, forMs = READ_FOR_MS, graceMs = ISBN_GRACE_MS } = {},
): Reading {
  let settle: (code: ScannedCode | null) => void = () => {};
  let abort: (error: Error) => void = () => {};
  const result = new Promise<ScannedCode | null>((resolve, reject) => {
    settle = resolve;
    abort = reject;
  });
  let other: ScannedCode | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopLoop = (): void => {};
  const end = (): void => {
    stopLoop();
    timers.forEach(clearTimeout);
  };
  const finish = (code: ScannedCode | null): void => {
    end();
    settle(code);
  };

  stopLoop = startDetectLoop({
    detect,
    intervalMs: everyMs,
    onDetections: (detections) => {
      const codes = codesFrom(detections);
      const isbn = codes.find((code) => code.kind === "isbn");
      if (isbn) return finish(isbn);
      if (other === null && codes.length > 0) {
        other = codes[0]!;
        timers.push(setTimeout(() => finish(other), graceMs));
      }
    },
  });
  timers.push(setTimeout(() => finish(other), forMs));
  return {
    result,
    cancel() {
      end();
      abort(new DOMException("The reading was stopped.", "AbortError"));
    },
  };
}

/**
 * Run `detect` every `intervalMs` until the returned stop function is called.
 * A slow frame delays the next one instead of overlapping it, and a failed
 * frame (the video between states) is skipped, not fatal.
 */
export function startDetectLoop(options: {
  detect: () => Promise<readonly Detection[]>;
  onDetections: (detections: readonly Detection[]) => void;
  intervalMs?: number;
}): () => void {
  const { detect, onDetections, intervalMs = READ_EVERY_MS } = options;
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
    timer = setTimeout(() => void tick(), Math.max(0, intervalMs - (Date.now() - started)));
  };

  // The first frame goes at once, so a code already under the camera reads instantly.
  timer = setTimeout(() => void tick(), 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
