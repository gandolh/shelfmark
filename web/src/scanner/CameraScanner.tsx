import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cameraFailure, hasTorch, openCamera, setTorch, stopStream } from "./camera";
import { createRepeatGuard } from "./debounce";
import { codesFrom, getEngine, startDetectLoop, type EngineChoice, type ScannedCode } from "./detector";
import { armFeedback, signalScan } from "./feedback";
import "./CameraScanner.css";

/**
 * What the scanner is doing. `asking` covers the permission prompt and the
 * camera starting; `insecure` is plain http on a phone (no camera API at all);
 * `error` is a camera another app holds, or a barcode reader that did not load.
 */
export type ScannerState = "asking" | "scanning" | "denied" | "no-camera" | "insecure" | "error";

export interface CameraScannerProps {
  /** Stop reading codes but keep the camera live, e.g. while a result sheet is open. */
  paused?: boolean;
  /** The torch the parent wants; ignored when the camera has none (see `onTorchAvailable`). */
  torch?: boolean;
  /** Beep and vibrate on each code. Default true. */
  feedback?: boolean;
  /** Each new code; the same code is quiet for 3 s after it fires. */
  onCode: (code: ScannedCode) => void;
  /** "Type the ISBN instead", offered in every state but scanning. */
  onFallback: () => void;
  onStateChange?: (state: ScannerState) => void;
  /** Whether a torch control would do anything; false until the camera runs. */
  onTorchAvailable?: (available: boolean) => void;
  className?: string;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

const pageVisible = (): boolean => document.visibilityState === "visible";

const MESSAGES: Record<Exclude<ScannerState, "scanning">, { title: string; detail: string; retry: boolean }> = {
  asking: {
    title: "Starting the camera",
    detail: "If your browser asks, allow the camera so Shelfmark can read barcodes.",
    retry: false,
  },
  denied: {
    title: "Camera access is off",
    detail: "Allow the camera for this site in your browser's settings, then try again.",
    retry: true,
  },
  "no-camera": {
    title: "No camera found",
    detail: "This device has no camera the browser can use.",
    retry: false,
  },
  insecure: {
    title: "The camera needs https",
    detail: "Browsers only open the camera on a secure connection. Open Shelfmark's https address.",
    retry: false,
  },
  error: {
    title: "The camera didn't start",
    detail: "Another app may be using it, or the barcode reader didn't load.",
    retry: true,
  },
};

/**
 * The phone camera as a stream of classified codes. One view, mounted and
 * unmounted by its parent: it never navigates or touches the URL, because in
 * an iOS home-screen app a route change can kill the camera and re-prompt
 * (scanning.md). The stream stops on unmount and while the page is hidden.
 */
export function CameraScanner({
  paused = false,
  torch = false,
  feedback = true,
  onCode,
  onFallback,
  onStateChange,
  onTorchAvailable,
  className,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visible = useSyncExternalStore(subscribeVisibility, pageVisible, () => true);
  const [secure] = useState(() => window.isSecureContext);
  const [state, setState] = useState<ScannerState>(secure ? "asking" : "insecure");
  const [engine, setEngine] = useState<EngineChoice | null>(null);
  const [engineFailed, setEngineFailed] = useState(false);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  // Bumped by "Try again" to rerun the engine and camera effects.
  const [attempt, setAttempt] = useState(0);
  const [guard] = useState(createRepeatGuard);
  // Counts reads so the frame can flash: the iPhone's silent switch mutes the
  // beep and iOS cannot vibrate.
  const [hits, setHits] = useState(0);

  useEffect(() => {
    if (feedback) armFeedback();
  }, [feedback]);

  useEffect(() => {
    if (!secure) return;
    let cancelled = false;
    getEngine().then(
      (choice) => {
        if (!cancelled) setEngine(choice);
      },
      () => {
        if (cancelled) return;
        setEngineFailed(true);
        setState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [secure, attempt]);

  // The camera runs only while the page is visible: hiding it stops every
  // track (the camera light goes off), showing it again opens a new stream.
  const cameraWanted = secure && visible && !engineFailed;
  useEffect(() => {
    const video = videoRef.current;
    if (!cameraWanted || video === null) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    openCamera()
      .then(async (opened) => {
        if (cancelled) {
          stopStream(opened);
          return;
        }
        stream = opened;
        video.srcObject = opened;
        await video.play();
        if (cancelled) return;
        setTrack(opened.getVideoTracks()[0] ?? null);
        setState("scanning");
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(cameraFailure(err));
      });
    return () => {
      cancelled = true;
      if (stream !== null) stopStream(stream);
      video.srcObject = null;
    };
  }, [cameraWanted, attempt]);

  const emit = useEffectEvent((code: ScannedCode) => {
    if (feedback) signalScan();
    setHits((n) => n + 1);
    onCode(code);
  });

  const reading = engine !== null && state === "scanning" && visible && !paused;
  // A book still in frame when the sheet closes (Save, Skip) must not fire
  // again: the 3 s window starts over from the moment the scanner resumes.
  useEffect(() => {
    if (reading) guard.touch();
  }, [reading, guard]);
  useEffect(() => {
    const video = videoRef.current;
    if (!reading || engine === null || video === null) return;
    const { detector } = engine;
    return startDetectLoop({
      // A video between streams has no frame to read.
      detect: () =>
        video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0
          ? detector.detect(video)
          : Promise.resolve([]),
      onDetections: (detections) => {
        for (const code of codesFrom(detections, guard)) emit(code);
      },
    });
  }, [reading, engine, guard]);

  const torchAvailable = useMemo(() => track !== null && hasTorch(track), [track]);
  useEffect(() => {
    if (track === null || !torchAvailable) return;
    // A track stopped by a hidden page rejects; the next stream reapplies it.
    setTorch(track, torch).catch(() => {});
  }, [track, torchAvailable, torch]);

  const reportState = useEffectEvent((next: ScannerState) => onStateChange?.(next));
  useEffect(() => {
    reportState(state);
  }, [state]);

  const reportTorch = useEffectEvent((available: boolean) => onTorchAvailable?.(available));
  const torchUsable = torchAvailable && state === "scanning";
  useEffect(() => {
    reportTorch(torchUsable);
  }, [torchUsable]);

  const retry = (): void => {
    setEngineFailed(false);
    setState("asking");
    setAttempt((n) => n + 1);
  };

  const message = state === "scanning" ? null : MESSAGES[state];
  return (
    <div
      className={className === undefined ? "scanner" : `scanner ${className}`}
      data-state={state}
      data-paused={paused || undefined}
      role="group"
      aria-label="Barcode scanner"
    >
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay aria-hidden="true" />
      {message === null ? (
        <div className="scanner-frame" aria-hidden="true">
          {hits > 0 && <span key={hits} className="scanner-hit" />}
        </div>
      ) : (
        <div className="scanner-message" role="status">
          <p className="scanner-message-title">{message.title}</p>
          <p className="scanner-message-detail">{message.detail}</p>
          <div className="scanner-actions">
            <button type="button" className="scanner-fallback" onClick={onFallback}>
              Type the ISBN instead
            </button>
            {message.retry && (
              <button type="button" className="scanner-retry" onClick={retry}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
