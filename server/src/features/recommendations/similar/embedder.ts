import { fork } from "node:child_process";
import type { EmbedReply, EmbedRequest } from "./protocol.js";

/**
 * Turns texts into vectors. The real one forks `embed-child` for each call
 * and ends it with the answer; tests pass a fake. Nothing loads the model
 * until a refresh asks, so a model that can't run fails that refresh, never
 * the server's start.
 */
export interface Embedder {
  /** One unit vector per text, in order. `onProgress` counts the texts done. Rejects when `signal` aborts. */
  embed(texts: readonly string[], onProgress: (done: number) => void, signal: AbortSignal): Promise<Float32Array[]>;
}

export interface ModelEmbedderOptions {
  /** Where the model's files are cached, `<dataDir>/models`: they outlive a deploy. */
  modelDir: string;
  /** The longest one call may take, the first download included. */
  timeoutMs?: number;
}

/** Ten minutes: the first run downloads 23 MB; a refresh after that takes seconds. */
const TIMEOUT_MS = 10 * 60 * 1000;
/** The child's last words on stderr, kept for the error the server logs. */
const STDERR_MAX = 4000;

// The child's own file: `.ts` when the server runs from source (tsx), `.js` when built.
const CHILD = new URL(import.meta.url.endsWith(".ts") ? "./embed-child.ts" : "./embed-child.js", import.meta.url);

export function createModelEmbedder({ modelDir, timeoutMs = TIMEOUT_MS }: ModelEmbedderOptions): Embedder {
  return {
    embed(texts, onProgress, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error("The refresh was stopped."));
          return;
        }
        const child = fork(CHILD, [], { serialization: "advanced", stdio: ["ignore", "ignore", "pipe", "ipc"] });
        let stderr = "";
        let settled = false;
        const finish = (error: Error | null, vectors?: Float32Array[]) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);
          child.kill();
          if (error) reject(error);
          else resolve(vectors ?? []);
        };
        const onAbort = () => finish(new Error("The refresh was stopped."));
        const timer = setTimeout(() => finish(new Error(`The model took longer than ${timeoutMs} ms.`)), timeoutMs);
        signal.addEventListener("abort", onAbort);

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr = (stderr + chunk.toString("utf8")).slice(-STDERR_MAX);
        });
        child.on("message", (reply: EmbedReply) => {
          if (reply.kind === "progress") onProgress(reply.done);
          else if (reply.kind === "error") finish(new Error(`The model failed: ${reply.message}`));
          else if (reply.vectors.length !== texts.length) {
            finish(new Error(`The model answered ${reply.vectors.length} vectors for ${texts.length} texts.`));
          } else finish(null, reply.vectors);
        });
        child.on("error", (error) => finish(error));
        child.on("exit", (code, exitSignal) => {
          const how = exitSignal ?? `code ${code ?? "?"}`;
          finish(new Error(`The model's process ended (${how}) before it answered. ${stderr.trim()}`.trim()));
        });
        const request: EmbedRequest = { modelDir, texts };
        child.send(request);
      });
    },
  };
}
