/**
 * The rear camera, as a stream for the scanner's <video>. The caller owns the
 * stream and stops it (`stopStream`) on unmount and whenever the page is hidden.
 */

/**
 * A bare `facingMode` is a preference, so a laptop with only a front camera
 * still opens one. 1280×720 is enough for a barcode in the frame and keeps
 * each WASM decode short on a phone.
 */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1280 },
  height: { ideal: 720 },
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

// `torch` is in the spec (Image Capture) but not in TypeScript's DOM types yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraintSet = MediaTrackConstraintSet & { torch: boolean };

/** Whether the track can light its torch. Chrome on Android says so; most others do not. */
export function hasTorch(track: MediaStreamTrack): boolean {
  if (typeof track.getCapabilities !== "function") return false;
  const capabilities: TorchCapabilities = track.getCapabilities();
  return capabilities.torch === true;
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  const torch: TorchConstraintSet = { torch: on };
  await track.applyConstraints({ advanced: [torch] });
}
