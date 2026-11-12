import { savedViewCreateSchema, savedViewPatchSchema } from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import { idParamsSchema } from "../../lib/id-params.js";
import { savedViewListOutputSchema, savedViewOutputSchema } from "./schemas.js";
import { createViewStore, ViewNameTaken } from "./store.js";

const noSuchView = () => new ApiError("not_found", "There is no such view.");

/** A positive integer in the path, or a 404, as in the book routes. */
function viewId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchView();
  return id;
}

/** A name another view has: `409 conflict`, with the store's message. */
const nameTaken = (error: ViewNameTaken) => new ApiError("conflict", error.message);

/** What the saved-view routes take from the app. */
export interface ViewRoutesOptions {
  db: Db;
}

/**
 * The saved views. A list answers `{ views }` by position; one
 * view answers the view. Bodies are declared with the shared schemas, so a bad
 * state is a 400 `validation` naming the field; a name another view has is a
 * 409 `conflict`.
 */
export const viewRoutes: FastifyPluginAsyncZod<ViewRoutesOptions> = async (app, { db }) => {
  const views = createViewStore(db);

  app.get("/api/views", { schema: { response: { 200: savedViewListOutputSchema } } }, () => ({
    views: views.list(),
  }));

  app.post(
    "/api/views",
    { schema: { body: savedViewCreateSchema, response: { 201: savedViewOutputSchema } } },
    (request, reply) => {
      try {
        const view = views.create(request.body);
        reply.code(201);
        return view;
      } catch (error) {
        if (error instanceof ViewNameTaken) throw nameTaken(error);
        throw error;
      }
    },
  );

  app.patch(
    "/api/views/:id",
    { schema: { params: idParamsSchema, body: savedViewPatchSchema, response: { 200: savedViewOutputSchema } } },
    (request) => {
      const id = viewId(request.params.id);
      try {
        const view = views.patch(id, request.body);
        if (!view) throw noSuchView();
        return view;
      } catch (error) {
        if (error instanceof ViewNameTaken) throw nameTaken(error);
        throw error;
      }
    },
  );

  app.delete(
    "/api/views/:id",
    { schema: { params: idParamsSchema, response: { 204: z.null() } } },
    (request, reply) => {
      if (!views.remove(viewId(request.params.id))) throw noSuchView();
      reply.code(204);
      return null;
    },
  );
};
