import { bookCreateSchema, bookPatchSchema, type BookList } from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError } from "../errors.js";

interface IdParams {
  Params: { id: string };
}

const noSuchBook = () => new ApiError("not_found", "There is no such book.");

/** A positive integer in the path, or a 404: `/api/books/abc` names no book, the same as `/api/books/999`. */
function bookId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchBook();
  return id;
}

/**
 * The book routes (brief 02). A list answers `{ books }`; one book answers the
 * book itself. Bodies are parsed with the shared schemas, so a bad one is a
 * 400 `validation` naming the field.
 */
export const bookRoutes: FastifyPluginAsync<FeatureContext> = async (app, { books }) => {
  app.get("/api/books", (): BookList => ({ books: books.list() }));

  app.get<IdParams>("/api/books/:id", (request) => {
    const book = books.get(bookId(request.params.id));
    if (!book) throw noSuchBook();
    return book;
  });

  app.post("/api/books", (request, reply) => {
    const input = bookCreateSchema.parse(request.body);
    reply.code(201);
    return books.create(input);
  });

  app.patch<IdParams>("/api/books/:id", (request) => {
    const id = bookId(request.params.id);
    const book = books.patch(id, bookPatchSchema.parse(request.body));
    if (!book) throw noSuchBook();
    return book;
  });

  app.delete<IdParams>("/api/books/:id", (request, reply) => {
    if (!books.remove(bookId(request.params.id))) throw noSuchBook();
    return reply.code(204).send();
  });
};
