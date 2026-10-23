import { savedViewCreateSchema, savedViewPatchSchema, type SavedViewList } from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError } from "../errors.js";
import { createViewStore, ViewNameTaken } from "../store/views.js";

interface IdParams {
  Params: { id: string };
}

const noSuchView = () => new ApiError("not_found", "There is no such view.");

/** A positive integer in the path, or a 404, as in the book routes. */
function viewId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchView();
  return id;
}

/** A name another view has: `409 conflict`, with the store's message. */
const nameTaken = (error: ViewNameTaken) => new ApiError("conflict", error.message);

/**
 * The saved views (brief 27). A list answers `{ views }` by position; one
 * view answers the view. Bodies are parsed with the shared schemas, so a bad
 * state is a 400 `validation` naming the field; a name another view has is a
 * 409 `conflict`.
 */
export const viewRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db }) => {
  const views = createViewStore(db);

  app.get("/api/views", (): SavedViewList => ({ views: views.list() }));

  app.post("/api/views", (request, reply) => {
    const input = savedViewCreateSchema.parse(request.body);
    try {
      const view = views.create(input);
      return reply.code(201).send(view);
    } catch (error) {
      if (error instanceof ViewNameTaken) throw nameTaken(error);
      throw error;
    }
  });

  app.patch<IdParams>("/api/views/:id", (request, reply) => {
    const id = viewId(request.params.id);
    const change = savedViewPatchSchema.parse(request.body);
    try {
      const view = views.patch(id, change);
      if (!view) throw noSuchView();
      return reply.send(view);
    } catch (error) {
      if (error instanceof ViewNameTaken) throw nameTaken(error);
      throw error;
    }
  });

  app.delete<IdParams>("/api/views/:id", (request, reply) => {
    if (!views.remove(viewId(request.params.id))) throw noSuchView();
    return reply.code(204).send();
  });
};
