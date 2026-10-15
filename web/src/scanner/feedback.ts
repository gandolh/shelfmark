/**
 * The beep and buzz when a code reads. Browsers only let a page make sound
 * after the person has interacted with it, and iOS Safari only lets an
 * AudioContext start inside a gesture handler, so `armFeedback` creates (and
 * later resumes) the context on a tap or key press. The iPhone's silent switch
 * mutes Web Audio and iOS has no vibration API, so a visual cue still matters.
 */

let audio: AudioContext | null = null;
let armed = false;

// Events that count as user activation: `pointerdown` from a finger does not,
// `pointerup` and `touchend` do.
const GESTURES = ["pointerup", "touchend", "keydown"] as const;

function hasUserActivation(): boolean {
  // Missing on older Safari; assume yes and let the browser decide.
  return navigator.userActivation?.hasBeenActive ?? true;
}

function unlock(): void {
  try {
    audio ??= new AudioContext();
    // iOS suspends ("interrupted") the context after a call or a trip to the
    // home screen, and only a gesture can resume it, so every gesture checks.
    if (audio.state !== "running") void audio.resume().catch(() => {});
  } catch {
    // No Web Audio here; the scanner stays silent.
  }
}

/**
 * Listen for the first gesture anywhere on the page. Idempotent; call it as
 * early as possible (app start), since the tap that opened the scanner has
 * already happened by the time the scanner mounts.
 */
export function armFeedback(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  for (const type of GESTURES) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

/** A short high beep. Silent until a gesture has unlocked audio. */
export function beep(): void {
  // Chrome allows a new context once the page has had any gesture.
  if (audio === null && hasUserActivation()) unlock();
  if (audio === null) return;
  if (audio.state !== "running") {
    // A beep queued on a suspended context would play late, in a burst; drop it.
    void audio.resume().catch(() => {});
    return;
  }
  const start = audio.currentTime;
  const tone = audio.createOscillator();
  const level = audio.createGain();
  tone.type = "sine";
  tone.frequency.value = 1320;
  // A 5 ms attack and a fast decay: no click at either end.
  level.gain.setValueAtTime(0.0001, start);
  level.gain.exponentialRampToValueAtTime(0.25, start + 0.005);
  level.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  tone.connect(level).connect(audio.destination);
  tone.start(start);
  tone.stop(start + 0.13);
}

/** A short buzz where the browser has `navigator.vibrate` (Android; not iOS). */
export function vibrate(): void {
  // Chrome refuses, with a console warning, before the first gesture.
  if (typeof navigator.vibrate !== "function" || !hasUserActivation()) return;
  navigator.vibrate(60);
}

/** What a read code sounds and feels like. */
export function signalScan(): void {
  beep();
  vibrate();
}
