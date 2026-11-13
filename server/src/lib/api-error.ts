/**
 * Every error the API sends is `{ "error": { "code", "message" } }`. A route
 * or a service throws `ApiError`; the error plugin (`plugins/errors.ts`)
 * answers it. A new code is one line in `ERROR_STATUS`. No Fastify import
 * here: it is pure.
 */
export const ERROR_STATUS = {
  validation: 400,
  /** A browser sent a change from a page on another origin (`plugins/auth/guard.ts`). */
  forbidden: 403,
  not_found: 404,
  /** The change clashes with what is stored: a saved view's name another view has (`features/views/routes.ts`). */
  conflict: 409,
  internal: 500,
  /** The server is stopping and gave up the request in flight (a lookup cut by the shutdown). */
  unavailable: 503,
  /** A host the server called (a cover download) failed or timed out. */
  upstream: 502,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/** Throw from a route or a service to answer `ERROR_STATUS[code]` with this message. */
export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}
