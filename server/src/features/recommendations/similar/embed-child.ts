import type { EmbedReply, EmbedRequest } from "./protocol.js";

/**
 * The model, run as its own short-lived process (`embedder.ts` forks it):
 * loads all-MiniLM-L6-v2 through transformers.js, embeds the texts it is
 * sent, answers with one unit vector per text, and is ended by the server.
 * Its own process because onnxruntime keeps about 200 MB after the model is
 * disposed; a process gives it all back when it ends. The first run downloads
 * the model's files (23 MB) from Hugging Face into `modelDir`; that request
 * names nothing about the library.
 */

const MODEL = "Xenova/all-MiniLM-L6-v2";
/** The model's files as measured on 2026-11-23: a new revision is a deliberate bump. */
const REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";
const BATCH = 32;

function send(reply: EmbedReply): void {
  process.send?.(reply);
}

async function run({ modelDir, texts }: EmbedRequest): Promise<void> {
  try {
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = modelDir;
    const extract = await pipeline("feature-extraction", MODEL, { dtype: "q8", revision: REVISION });
    const vectors: Float32Array[] = [];
    for (let start = 0; start < texts.length; start += BATCH) {
      const output = await extract([...texts.slice(start, start + BATCH)], { pooling: "mean", normalize: true });
      const { data } = output;
      const [rows = 0, width = 0] = output.dims;
      if (!(data instanceof Float32Array)) throw new Error("The model answered with something other than floats.");
      for (let row = 0; row < rows; row++) vectors.push(data.slice(row * width, (row + 1) * width));
      send({ kind: "progress", done: vectors.length });
    }
    send({ kind: "vectors", vectors });
  } catch (error) {
    send({ kind: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

process.once("message", (request: EmbedRequest) => {
  void run(request);
});
