import { useEffect, useEffectEvent, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { cameraFailure, hasTorch, openCamera, setTorch, stopStream } from "./camera";
import { getEngine, readCode, type EngineChoice, type Reading, type ScannedCode } from "./detector";
import { armFeedback, signalScan } from "./feedback";
import "./CameraScanner.css";

/**
 * What the scanner is doing. `asking` covers the permission prompt and the
 * camera starting; `insecure` is plain http on a phone (no camera API at all);
 * `error` is a camera another app holds, or a barcode reader that did not load.
 */
export type ScannerState = "asking" | "scanning" | "denied" | "no-camera" | "insecure" | "error";

/** What the parent asks of a running scanner. */
export interface ScannerHandle {
  /**
   * Read the barcode in view: a code once two reads agree, or `null` when
   * none is read within 3 s (detector.ts `readCode`). A second call while one
   * runs gets the same answer. Rejects with an `AbortError` when the camera
   * stops or the scanner is paused meanwhile, and at once when it isn't
   * scanning.
   */
  read(): Promise<ScannedCode | null>;
}

export interface CameraScannerProps {
  /** The handle the page reads through: the camera reads nothing until asked. */
  ref?: Ref<ScannerHandle>;
  /** Keep the camera live but refuse to read, e.g. while a result is open: the frame dims. */
  paused?: boolean;
  /** The torch the parent wants; ignored when the camera has none (see `onTorchAvailable`). */
  torch?: boolean;
  /** Beep and vibrate on each code read. Default true. */
  feedback?: boolean;
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
 * The phone camera, read on request: the picture runs so the owner can aim,
 * and a code is read only when the parent asks (`ref.read()`). One view, mounted and
 * unmounted by its parent: it never navigates or touches the URL, because in
 * an iOS home-screen app a route change can kill the camera and re-prompt
 * (scanning.md). The stream stops on unmount and while the page is hidden.
 */
export function CameraScanner({
  ref,
  paused = false,
  torch = false,
  feedback = true,
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

  // The reading a press started, until it ends.
  const current = useRef<{ reading: Reading; result: Promise<ScannedCode | null> } | null>(null);
  const canRead = engine !== null && state === "scanning" && visible && !paused;
  // Pausing, a hidden page or unmounting stops a reading in progress.
  useEffect(() => {
    if (!canRead) return;
    return () => {
      current.current?.reading.cancel();
      current.current = null;
    };
  }, [canRead]);

  useImperativeHandle(
    ref,
    () => ({
      read() {
        const video = videoRef.current;
        if (!canRead || engine === null || video === null) {
          return Promise.reject(new DOMException("The scanner isn't reading.", "AbortError"));
        }
        if (current.current !== null) return current.current.result;
        const { detector } = engine;
        const reading = readCode(() =>
          // A video between streams has no frame to read.
          video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 ? detector.detect(video) : Promise.resolve([]),
        );
        const result = reading.result
          .then((code) => {
            if (code !== null) {
              if (feedback) signalScan();
              setHits((n) => n + 1);
            }
            return code;
          })
          .finally(() => {
            if (current.current?.reading === reading) current.current = null;
          });
        current.current = { reading, result };
        return result;
      },
    }),
    [canRead, engine, feedback],
  );

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
