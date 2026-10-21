import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import {
  cameraFailure,
  capabilitiesOf,
  hasTorch,
  openCamera,
  readoutLines,
  stopStream,
  tuneCamera,
  zoomsTo2x,
  type Zoom,
} from "./camera";
import { getEngine, readCode, type Engine, type EngineChoice, type Reading, type ScannedCode } from "./detector";
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
   * Read the barcode in view, for as long as it takes: the first code read,
   * or `null` when nothing is read for a minute (detector.ts `readCode`). A
   * second call while one runs gets the same answer. Rejects with an
   * `AbortError` on `stop()`, when the camera stops or the scanner is paused
   * meanwhile, and at once when it isn't scanning.
   */
  read(): Promise<ScannedCode | null>;
  /** Stop the reading in progress, if any: its `read()` rejects with an `AbortError`. */
  stop(): void;
}

/** The camera as the readout shows it: the engine and the live track. */
export interface CameraInfo {
  engine: Engine;
  track: MediaStreamTrack;
}

export interface CameraScannerProps {
  /** The handle the page reads through: the camera reads nothing until asked. */
  ref?: Ref<ScannerHandle>;
  /** Keep the camera live but refuse to read, e.g. while a result is open: the frame dims. */
  paused?: boolean;
  /** The torch the parent wants; ignored when the camera has none (see `onTorchAvailable`). */
  torch?: boolean;
  /** The zoom the parent wants; ignored when the camera can't zoom to 2 (see `onZoomAvailable`). Default 2. */
  zoom?: Zoom;
  /** Beep and vibrate on each code read. Default true. */
  feedback?: boolean;
  /** "Type the ISBN instead", offered in every state but scanning. */
  onFallback: () => void;
  onStateChange?: (state: ScannerState) => void;
  /** Whether a torch control would do anything; false until the camera runs. */
  onTorchAvailable?: (available: boolean) => void;
  /** Whether a 1× / 2× zoom chip would do anything; false until the camera runs. */
  onZoomAvailable?: (available: boolean) => void;
  /** For the readout: the engine and the track while the camera runs, else `null`. */
  onCamera?: (camera: CameraInfo | null) => void;
  /** For the readout: each decode's time in ms, while a press reads. Not measured without it. */
  onDecode?: (ms: number) => void;
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
  zoom = 2,
  feedback = true,
  onFallback,
  onStateChange,
  onTorchAvailable,
  onZoomAvailable,
  onCamera,
  onDecode,
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
        const reading = readCode(async () => {
          // A video between streams has no frame to read.
          if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return [];
          if (onDecode === undefined) return detector.detect(video);
          const started = performance.now();
          const detections = await detector.detect(video);
          onDecode(performance.now() - started);
          return detections;
        });
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
      stop() {
        current.current?.reading.cancel();
        current.current = null;
      },
    }),
    [canRead, engine, feedback, onDecode],
  );

  const torchAvailable = useMemo(() => track !== null && hasTorch(track), [track]);
  const zoomAvailable = useMemo(() => track !== null && zoomsTo2x(capabilitiesOf(track)), [track]);
  // The torch, the zoom and continuous focus, where the camera offers each,
  // applied as the stream opens and again on each change. A track stopped by
  // a hidden page rejects; the next stream applies them again.
  useEffect(() => {
    if (track === null) return;
    tuneCamera(track, { torch, zoom }).catch(() => {});
  }, [track, torch, zoom]);

  const reportState = useEffectEvent((next: ScannerState) => onStateChange?.(next));
  useEffect(() => {
    reportState(state);
  }, [state]);

  const reportTorch = useEffectEvent((available: boolean) => onTorchAvailable?.(available));
  const torchUsable = torchAvailable && state === "scanning";
  useEffect(() => {
    reportTorch(torchUsable);
  }, [torchUsable]);

  const reportZoom = useEffectEvent((available: boolean) => onZoomAvailable?.(available));
  const zoomUsable = zoomAvailable && state === "scanning";
  useEffect(() => {
    reportZoom(zoomUsable);
  }, [zoomUsable]);

  const reportCamera = useEffectEvent((camera: CameraInfo | null) => onCamera?.(camera));
  const camera = useMemo<CameraInfo | null>(
    () => (state === "scanning" && engine !== null && track !== null ? { engine: engine.engine, track } : null),
    [state, engine, track],
  );
  useEffect(() => {
    reportCamera(camera);
  }, [camera]);

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

/**
 * `?camera` on the Add page: the camera's numbers (scanning.md, "Camera
 * quality"). Only the owner's phone can say whether a soft picture is the
 * stream's size or the lens, so it ships, behind an address nobody links to.
 * The settings change once zoom and focus are applied, so they are read again
 * every second.
 */
export function CameraReadout({
  camera,
  decodeMs,
  className,
}: {
  camera: CameraInfo | null;
  decodeMs: number | null;
  className?: string;
}) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (camera === null) return;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [camera]);
  if (camera === null) return null;
  const { engine, track } = camera;
  const lines = readoutLines({
    engine,
    label: track.label,
    settings: track.getSettings(),
    capabilities: capabilitiesOf(track),
    decodeMs,
  });
  return (
    <div className={className === undefined ? "scanner-readout" : `scanner-readout ${className}`}>
      {/* Four lines, always in the same order. */}
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </div>
  );
}
