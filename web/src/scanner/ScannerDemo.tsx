import { useEffect, useRef, useState } from "react";
import { CameraReadout, CameraScanner, type CameraInfo, type ScannerHandle, type ScannerState } from "./CameraScanner";
import { getEngine, type Engine, type ScannedCode } from "./detector";

/**
 * Dev only (`/dev/scanner`): the scanner with every control, a Read button
 * (Stop while it reads), the camera readout, and a list of what each read came to. It also lists what the page fetched, so a phone without a
 * network panel can still show the .wasm came from our own origin.
 */

interface Read {
  id: number;
  at: string;
  code: ScannedCode | null;
}

interface Fetched {
  wasm: string[];
  foreign: string[];
}

function fetched(): Fetched {
  const urls = performance.getEntriesByType("resource").map((entry) => new URL(entry.name));
  return {
    // In dev, `…wasm?import&url` is the module that exports the URL, not the file.
    wasm: urls.filter((url) => url.pathname.endsWith(".wasm") && !url.search.includes("import")).map(String),
    foreign: urls.filter((url) => url.origin !== window.location.origin).map(String),
  };
}

const layout = { display: "grid", gap: 12, padding: 16, maxWidth: 640, margin: "0 auto" } as const;

export function ScannerDemo() {
  const scanner = useRef<ScannerHandle>(null);
  const [reads, setReads] = useState<Read[]>([]);
  const [reading, setReading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [state, setState] = useState<ScannerState | "mounting">("mounting");
  const [fallbacks, setFallbacks] = useState(0);
  const [engine, setEngine] = useState<Engine | "loading" | "failed">("loading");
  const [network, setNetwork] = useState<Fetched | null>(null);
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [decodeMs, setDecodeMs] = useState<number | null>(null);

  useEffect(() => {
    // The same cached choice the scanner uses; this only reads it.
    getEngine().then(
      (choice) => {
        setEngine(choice.engine);
        setNetwork(fetched());
      },
      () => setEngine("failed"),
    );
  }, []);

  const read = async (): Promise<void> => {
    if (scanner.current === null) return;
    if (reading) {
      scanner.current.stop();
      return;
    }
    setReading(true);
    try {
      const code = await scanner.current.read();
      setReads((list) => [{ id: Date.now() + Math.random(), at: new Date().toLocaleTimeString(), code }, ...list]);
    } catch {
      // Stopped: Stop, paused or hidden.
    } finally {
      setReading(false);
    }
  };

  return (
    <main style={layout}>
      <h1 style={{ margin: 0 }}>Scanner demo</h1>
      <p style={{ margin: 0 }}>
        State <strong>{state}</strong> · engine <strong>{engine}</strong> · torch{" "}
        <strong>{torchAvailable ? "available" : "not available"}</strong> · fallback asked{" "}
        <strong>{fallbacks}</strong>×
      </p>
      <div style={{ height: "55vh" }}>
        <CameraScanner
          ref={scanner}
          paused={paused}
          torch={torch}
          onFallback={() => setFallbacks((n) => n + 1)}
          onStateChange={setState}
          onTorchAvailable={setTorchAvailable}
          onCamera={setCamera}
          onDecode={setDecodeMs}
        />
      </div>
      <CameraReadout camera={camera} decodeMs={decodeMs} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={() => void read()} disabled={paused}>
          {reading ? "Stop" : "Read"}
        </button>
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setTorch((t) => !t)} disabled={!torchAvailable}>
          {torch ? "Torch off" : "Torch on"}
        </button>
        <button type="button" onClick={() => setReads([])} disabled={reads.length === 0}>
          Clear
        </button>
        <button type="button" onClick={() => setNetwork(fetched())}>
          Refresh fetches
        </button>
      </div>
      <section>
        <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Read ({reads.length})</h2>
        {reads.length === 0 ? (
          <p style={{ margin: 0 }}>Nothing yet. Hold a book's back cover in the frame and press Read.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {reads.map(({ id, at, code }) => (
              <li key={id}>
                {at} ·{" "}
                {code === null ? (
                  "nothing read in a minute"
                ) : (
                  <>
                    <strong>{code.kind}</strong> · {code.kind === "isbn" ? code.isbn13 : code.code}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      {network !== null && (
        <section>
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Fetched</h2>
          <p style={{ margin: 0, overflowWrap: "anywhere" }}>
            .wasm: {network.wasm.length === 0 ? "none (native engine)" : network.wasm.join(", ")}
          </p>
          <p style={{ margin: 0, overflowWrap: "anywhere" }}>
            Other origins: {network.foreign.length === 0 ? "none" : network.foreign.join(", ")}
          </p>
        </section>
      )}
    </main>
  );
}

// Default too, so the dev route can be `lazy(() => import("../scanner/ScannerDemo"))`.
export default ScannerDemo;
