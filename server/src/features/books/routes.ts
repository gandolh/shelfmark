import {
  bookBulkResultSchema,
  bookBulkSchema,
  bookCreateSchema,
  bookListSchema,
  bookPatchSchema,
  bookSchema,
} from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyRequest } from "fastify";
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

/**
 * The signed-in person's account id: every book reads as theirs, and a status
 * or rating written is theirs. The sign-in guard answers 401 before a route
 * runs without a session, so a missing one here is a bug, answered 500.
 */
function readerOf(request: FastifyRequest): string {
  const user = request.auth?.user;
  if (!user) throw new Error("A book route ran without a signed-in user.");
  return user.id;
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
 * Every book is read and written as the signed-in person's (`BookStore`).
 */
export const bookRoutes: FastifyPluginAsyncZod<BookRoutesOptions> = async (app, { books }) => {
  app.get("/api/books", { schema: { response: { 200: bookListSchema } } }, (request) => ({
    books: books.list(readerOf(request)),
  }));

  app.get("/api/books/:id", { schema: { params: idParamsSchema, response: { 200: bookSchema } } }, (request) => {
    const book = books.get(bookId(request.params.id), readerOf(request));
    if (!book) throw noSuchBook();
    return book;
  });

  app.post("/api/books", { schema: { body: bookCreateSchema, response: { 201: bookSchema } } }, (request, reply) => {
    reply.code(201);
    return books.create(request.body, readerOf(request));
  });

  app.post(
    "/api/books/bulk",
    { schema: { body: bookBulkSchema, response: { 200: bookBulkResultSchema } } },
    (request) => {
      const { ids, change } = request.body;
      const outcome = books.bulk(ids, change, readerOf(request));
      if ("unknown" in outcome) throw noSuchBooks(outcome.unknown);
      return outcome.done;
    },
  );

  app.patch(
    "/api/books/:id",
    { schema: { params: idParamsSchema, body: bookPatchSchema, response: { 200: bookSchema } } },
    (request) => {
      const id = bookId(request.params.id);
      const book = books.patch(id, request.body, readerOf(request));
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
