import {
  bookBulkResultSchema,
  bookBulkSchema,
  bookCreateSchema,
  bookListSchema,
  bookPatchSchema,
  bookSchema,
} from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../lib/api-error.js";
import { idParamsSchema } from "../../lib/id-params.js";
import type { BookStore } from "./store.js";

const noSuchBook = () => new ApiError("not_found", "There is no such book.");

/** A positive integer in the path, or a 404: `/api/books/abc` names no book, the same as `/api/books/999`. */
function bookId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchBook();
  return id;
}

/** A bulk change named books that don't exist: say which, and that nothing changed. */
function noSuchBooks(ids: readonly number[]): ApiError {
  const named = ids.length === 1 ? `There is no book ${ids[0]}` : `There are no books ${ids.join(", ")}`;
  return new ApiError("validation", `ids: ${named}, so nothing was changed.`);
}

/** What the book routes take from the app. */
export interface BookRoutesOptions {
  books: BookStore;
}

/**
 * The book routes. A list answers `{ books }`; one book answers the
 * book itself. Bodies are declared with the shared schemas, so a bad one is a
 * 400 `validation` naming the field. `POST /api/books/bulk` makes
 * one change to many books in one transaction and answers `BookBulkResult`.
 */
export const bookRoutes: FastifyPluginAsyncZod<BookRoutesOptions> = async (app, { books }) => {
  app.get("/api/books", { schema: { response: { 200: bookListSchema } } }, () => ({ books: books.list() }));

  app.get("/api/books/:id", { schema: { params: idParamsSchema, response: { 200: bookSchema } } }, (request) => {
    const book = books.get(bookId(request.params.id));
    if (!book) throw noSuchBook();
    return book;
  });

  app.post("/api/books", { schema: { body: bookCreateSchema, response: { 201: bookSchema } } }, (request, reply) => {
    reply.code(201);
    return books.create(request.body);
  });

  app.post(
    "/api/books/bulk",
    { schema: { body: bookBulkSchema, response: { 200: bookBulkResultSchema } } },
    (request) => {
      const { ids, change } = request.body;
      const outcome = books.bulk(ids, change);
      if ("unknown" in outcome) throw noSuchBooks(outcome.unknown);
      return outcome.done;
    },
  );

  app.patch(
    "/api/books/:id",
    { schema: { params: idParamsSchema, body: bookPatchSchema, response: { 200: bookSchema } } },
    (request) => {
      const id = bookId(request.params.id);
      const book = books.patch(id, request.body);
      if (!book) throw noSuchBook();
      return book;
    },
  );

  app.delete(
    "/api/books/:id",
    { schema: { params: idParamsSchema, response: { 204: z.null() } } },
    (request, reply) => {
      if (!books.remove(bookId(request.params.id))) throw noSuchBook();
      reply.code(204);
      return null;
    },
  );
};
