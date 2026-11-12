import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "@fastify/type-provider-zod";
import type { FastifyError, FastifyPluginAsync, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { ApiError, ERROR_STATUS, errorBody, type ErrorBody, type ErrorCode } from "../lib/api-error.js";

/** Answer with an error. Returns the reply, so a hook can `return sendError(...)`. */
export function sendError(reply: FastifyReply, code: ErrorCode, message: string): FastifyReply {
  return reply.code(ERROR_STATUS[code]).send(errorBody(code, message));
}

/** The first issue, prefixed with the field it is about: "isbn13: must be 13 digits…". */
function describeIssue(path: string, message: string | undefined): string {
  const text = message ?? "The request is not valid.";
  return path ? `${path}: ${text}` : text;
}

function statusOf(error: unknown): number | undefined {
  const status = (error as Partial<FastifyError> | null)?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/** What to send for an error, and whether it is a fault to log. */
export interface MappedError {
  status: number;
  body: ErrorBody;
  /** `reply`: a handler sent what its response schema doesn't allow. `unhandled`: anything else that became a 500. */
  fault?: "reply" | "unhandled";
}

/**
 * The error handler's decision, without Fastify, so each case is tested on its
 * own. In order:
 *
 * - `ApiError` → its code.
 * - A request that fails its route schema → 400 `validation`, with the first
 *   issue's field and message.
 * - A zod error → 400 `validation`: a parse left in a service. `instanceof`
 *   checks traits, so it also matches errors thrown by `@shelfmark/shared`'s zod.
 * - A 4xx Fastify raised itself (bad JSON, a body too large, an unsupported
 *   content type) keeps its status, with `not_found` for 404 and
 *   `validation` for the rest.
 * - A reply that fails its response schema → 500 `internal`, a fault to log;
 *   the client never sees it.
 * - Anything else → 500 `internal`, a fault to log. A thrown message is never
 *   sent to the client.
 */
export function mapError(error: unknown): MappedError {
  if (error instanceof ApiError) {
    return { status: ERROR_STATUS[error.code], body: errorBody(error.code, error.message) };
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    const issue = error.validation[0];
    // `/changes/title` is `changes.title`; a root issue (`/`) has no field.
    const path = (issue?.instancePath ?? "").split("/").filter(Boolean).join(".");
    return { status: 400, body: errorBody("validation", describeIssue(path, issue?.message)) };
  }

  if (error instanceof z.core.$ZodError) {
    const issue = error.issues[0];
    return {
      status: 400,
      body: errorBody("validation", describeIssue(issue?.path.map(String).join(".") ?? "", issue?.message)),
    };
  }

  const status = statusOf(error);
  if (status !== undefined && status >= 400 && status < 500) {
    const message = error instanceof Error ? error.message : "The request is not valid.";
    return { status, body: errorBody(status === 404 ? "not_found" : "validation", message) };
  }

  const fault = isResponseSerializationError(error) ? "reply" : "unhandled";
  return { status: 500, body: errorBody("internal", "Something went wrong on the server."), fault };
}

/**
 * The error handler and the 404 handler, wrapped in `fastify-plugin` and
 * registered first, so every plugin and feature inherits them. `mapError`
 * decides; this logs the faults and sends. The 404 handler isn't
 * rate-limited: `@fastify/rate-limit` isn't a dependency.
 */
const errorHandling: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: unknown, request, reply) => {
    const { status, body, fault } = mapError(error);
    if (fault === "reply" && isResponseSerializationError(error)) {
      // A handler sent what its response schema doesn't allow: a bug to fix, never the client's fault.
      // Method, URL and the error's name and code only: the issues would quote a book's own fields.
      request.log.error(
        { err: { name: error.name, code: error.code } },
        `${error.method} ${error.url}: the reply doesn't match its schema`,
      );
    } else if (fault === "unhandled") {
      request.log.error({ err: error }, "unhandled error");
    }
    return reply.code(status).send(body);
  });

  app.setNotFoundHandler((_request, reply) => sendError(reply, "not_found", "There is no such route."));
};

export const errors = fp(errorHandling, { name: "errors" });
