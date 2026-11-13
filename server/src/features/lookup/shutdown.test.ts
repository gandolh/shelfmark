import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../db/open.js";
import { ApiError, errorBody, ERROR_STATUS } from "../../lib/api-error.js";
import { fakeFetch, hang } from "../../testing/fakeFetch.js";
import { createBookStore } from "../books/index.js";
import { openCipStore } from "./cip/store.js";
import { createLibrarySource } from "./libraries.js";
import { createQueue, realClock } from "./queue.js";
import { lookupRoutes } from "./routes.js";
import { searchIsbns, type Connect } from "./z3950/client.js";

const PIRAMIDA = "9786068044873";
const never: Connect = () => new Duplex({ read() {}, write: (_chunk, _encoding, done) => done() });

const open: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((app) => app.close()));
});

/** Only the lookup route, on a real socket (`inject()` never shows a held response), over stubs that never answer. */
async function listening(
  options: { openLibrary?: "hang" | "down" } = {},
): Promise<{ app: FastifyInstance; url: string }> {
  const app = Fastify();
  open.push(app);
  const db = openDb(":memory:");
  const cip = openCipStore(":memory:");
  app.addHook("onClose", async () => {
    db.close();
    cip.close();
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error: Error, _request, reply) => {
    const code = error instanceof ApiError ? error.code : "internal";
    return reply.code(ERROR_STATUS[code]).send(errorBody(code, error.message));
  });
  await app.register(lookupRoutes, {
    config: { googleBooksApiKey: undefined },
    db,
    books: createBookStore(db),
    fetch: fakeFetch((_url, init) => (options.openLibrary === "down" ? undefined : hang(init))),
    connect: never,
    cip,
  });
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  return { app, url };
}

describe("a stop with a lookup in flight", () => {
  it("answers it 503 and closes at once, though every source hangs", async () => {
    const { app, url } = await listening();
    const answered = fetch(`${url}/api/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isbn: PIRAMIDA }),
    });
    // Open Library's request is the one held now.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const started = performance.now();
    await app.close();
    const response = await answered;

    expect(performance.now() - started).toBeLessThan(1000);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("unavailable");
  });

  it("closes at once while the lookup is held by a library catalog that never answers", async () => {
    const { app, url } = await listening({ openLibrary: "down" });
    // Skip Open Library: its stub fails fast here, so the catalogs (the Z39.50 sockets) hold the lookup.
    const answered = fetch(`${url}/api/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isbn: PIRAMIDA }),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const started = performance.now();
    await app.close();
    expect((await answered).status).toBe(503);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("the abort, one layer down", () => {
  it("destroys a Z39.50 socket and rejects with the reason", async () => {
    const controller = new AbortController();
    let socket: Duplex | undefined;
    const connect: Connect = () => (socket = never("", 0));
    const exchange = searchIsbns(
      { label: "A library", host: "h", port: 1, database: "D", syntax: "unimarc" },
      [PIRAMIDA],
      {
        connect,
        timeoutMs: 60_000,
        maxRecords: 1,
        implementation: { name: "t", version: "0" },
        signal: controller.signal,
      },
    );
    controller.abort(new Error("stopping"));
    await expect(exchange).rejects.toThrow("stopping");
    expect(socket?.destroyed).toBe(true);
  });

  it("makes a library source fail at once, also from the queue's pause", async () => {
    const controller = new AbortController();
    const source = createLibrarySource("biblacad", {
      connect: never,
      queue: createQueue(60_000, realClock, controller.signal),
      signal: controller.signal,
    });
    // The first request holds the queue; the second waits its turn behind it.
    const first = source.fetch(PIRAMIDA);
    const second = source.fetch(PIRAMIDA);
    controller.abort(new Error("stopping"));
    await expect(first).rejects.toThrow("stopping");
    await expect(second).rejects.toThrow("stopping");
  });

  it("stops a queue's sleep and starts nothing after", async () => {
    const controller = new AbortController();
    const queue = createQueue(60_000, realClock, controller.signal);
    await queue.run(async () => undefined);
    let ran = false;
    const waiting = queue.run(async () => (ran = true));
    controller.abort(new Error("stopping"));
    await expect(waiting).rejects.toThrow("stopping");
    await expect(queue.run(async () => (ran = true))).rejects.toThrow("stopping");
    expect(ran).toBe(false);
  });
});
