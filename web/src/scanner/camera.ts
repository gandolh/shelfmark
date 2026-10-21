/**
 * The rear camera, as a stream for the scanner's <video>. The caller owns the
 * stream and stops it (`stopStream`) on unmount and whenever the page is hidden.
 */

/**
 * A bare `facingMode` is a preference, so a laptop with only a front camera
 * still opens one. No lens is chosen by label: Android names its lenses
 * `camera2 0, facing back` and so on, and an iPhone switches lenses by itself
 * (scanning.md, "Camera quality"). 1920×1080 is `ideal`, so the browser gives
 * what it can; in portrait, 720p stretched its short side about 1.6× across a
 * phone's screen. `?camera` on the Add page shows what was granted.
 */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

export async function openCamera(): Promise<MediaStream> {
  // Absent outside a secure context and in browsers without camera support.
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    throw new DOMException("This browser has no camera API.", "NotFoundError");
  }
  return navigator.mediaDevices.getUserMedia({ audio: false, video: VIDEO_CONSTRAINTS });
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** Why the camera did not start, in the scanner's terms. */
export type CameraFailure = "denied" | "no-camera" | "error";

/** Map a `getUserMedia` rejection to what the scanner tells the owner. */
export function cameraFailure(err: unknown): CameraFailure {
  const name = typeof err === "object" && err !== null && "name" in err ? String(err.name) : "";
  switch (name) {
    case "NotAllowedError": // the owner said no, or the browser remembers a no
    case "SecurityError": // a permissions policy forbids the camera here
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    default:
      // NotReadableError (another app holds the camera), AbortError, anything else.
      return "error";
  }
}

// --- What the camera can do, and what it was set to -------------------------------

/**
 * A track's capabilities as the scanner reads them. `torch`, `zoom` and
 * `focusMode` are in the spec (Image Capture) but not all in TypeScript's DOM
 * types yet. Chrome on Android lists what the camera supports; Safari lists
 * less (no focus); Firefox may have no `getCapabilities` at all.
 */
export type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min?: number; max?: number; step?: number };
  focusMode?: string[];
};

/** A track's settings, with the Image Capture fields the readout shows. */
export type CameraSettings = MediaTrackSettings & { focusMode?: string };

/** The track's capabilities, or none when the browser doesn't report them. */
export function capabilitiesOf(track: MediaStreamTrack): CameraCapabilities {
  if (typeof track.getCapabilities !== "function") return {};
  try {
    return track.getCapabilities();
  } catch {
    // A stopped track may refuse; it has nothing to offer anyway.
    return {};
  }
}

/** Whether the track can light its torch. Chrome on Android says so; most others do not. */
export function hasTorch(track: MediaStreamTrack): boolean {
  return capabilitiesOf(track).torch === true;
}

/** The zoom the 1× / 2× chip offers. */
export type Zoom = 1 | 2;

/**
 * Whether the 1× / 2× chip does anything: the camera zooms to 2 at least. At
 * 2× a barcode fills the viewfinder from about 20 cm, beyond the close-focus
 * limit of most main lenses; on Android zoom crops the sensor before it scales
 * down to the stream, so 2× adds real detail.
 */
export function zoomsTo2x(capabilities: CameraCapabilities): boolean {
  const max = capabilities.zoom?.max;
  return typeof max === "number" && max >= 2;
}

/** Whether the camera offers continuous focus. Chrome on Android lists focus modes; Safari doesn't. */
export function focusesContinuously(capabilities: CameraCapabilities): boolean {
  return Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous");
}

/** What the page wants of the camera, each part applied only where the camera offers it. */
export interface CameraWish {
  torch: boolean;
  zoom: Zoom;
}

type TuningSet = MediaTrackConstraintSet & { torch?: boolean; zoom?: number; focusMode?: string };

/**
 * The one constraint set for what the camera offers: the torch, the chip's
 * zoom and continuous focus, each only when the capabilities list it; `null`
 * when they list none. All in one set, so applying one never depends on an
 * earlier `applyConstraints` call having kept another.
 */
export function tuningFor(capabilities: CameraCapabilities, wish: CameraWish): TuningSet | null {
  const set: TuningSet = {};
  if (capabilities.torch === true) set.torch = wish.torch;
  if (zoomsTo2x(capabilities)) {
    const min = capabilities.zoom?.min ?? 1;
    set.zoom = Math.max(min, wish.zoom);
  }
  if (focusesContinuously(capabilities)) set.focusMode = "continuous";
  return Object.keys(set).length > 0 ? set : null;
}

/**
 * Apply the torch, the zoom and continuous focus where the camera offers
 * them. Does nothing on a camera that offers none of them (an iPhone with no
 * zoom, most laptops). A stopped track rejects; the next stream applies them again.
 */
export async function tuneCamera(track: MediaStreamTrack, wish: CameraWish): Promise<void> {
  const set = tuningFor(capabilitiesOf(track), wish);
  if (set !== null) await track.applyConstraints({ advanced: [set] });
}

// --- The readout (`?camera` on the Add page) -----------------------------------------

/** What the readout shows: the engine and the track, and the last decode's time. */
export interface ReadoutInput {
  engine: string;
  label: string;
  settings: CameraSettings;
  capabilities: CameraCapabilities;
  /** The last decode's time in ms, `null` before the first. */
  decodeMs: number | null;
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * The readout's lines: the engine and the camera's name; what the browser
 * granted; what the camera can do; the last decode's time. A value the
 * browser doesn't report is left out, or "not reported" when a whole line is.
 */
export function readoutLines({ engine, label, settings, capabilities, decodeMs }: ReadoutInput): string[] {
  const granted: string[] = [];
  if (settings.width !== undefined && settings.height !== undefined) granted.push(`${settings.width}×${settings.height}`);
  if (settings.frameRate !== undefined) granted.push(`${round(settings.frameRate)} fps`);
  if (settings.zoom !== undefined) granted.push(`zoom ${round(settings.zoom)}`);
  if (settings.focusMode !== undefined) granted.push(`focus ${settings.focusMode}`);

  const can: string[] = [];
  const { width, height, zoom, focusMode, torch } = capabilities;
  if (width?.max !== undefined && height?.max !== undefined) can.push(`up to ${width.max}×${height.max}`);
  if (zoom?.max !== undefined) can.push(`zoom ${round(zoom.min ?? 1)}–${round(zoom.max)}`);
  if (focusMode !== undefined) can.push(`focus ${focusMode.length > 0 ? focusMode.join(", ") : "none"}`);
  if (torch !== undefined) can.push(torch ? "torch" : "no torch");

  return [
    `${engine} · ${label === "" ? "unnamed camera" : label}`,
    `got ${granted.length > 0 ? granted.join(" · ") : "not reported"}`,
    `can ${can.length > 0 ? can.join(" · ") : "not reported"}`,
    `decode ${decodeMs === null ? "–" : `${Math.round(decodeMs)} ms`}`,
  ];
}
