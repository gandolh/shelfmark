/**
 * The messages between the server and the model's child process
 * (`embed-child.ts`), sent with Node's advanced serialization so the vectors
 * travel as `Float32Array`s.
 */

export interface EmbedRequest {
  /** Where the model's files are cached: `<dataDir>/models`. */
  modelDir: string;
  texts: readonly string[];
}

export type EmbedReply =
  | { kind: "progress"; done: number }
  | { kind: "vectors"; vectors: Float32Array[] }
  | { kind: "error"; message: string };
