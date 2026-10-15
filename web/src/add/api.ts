import { coverInfoSchema, lookupResponseSchema, type CoverInfo, type LookupResponse } from "@shelfmark/shared";
import { apiBlob, apiRequest, coverPath, isApiError } from "../api";
import { coverChanged } from "../books/store";
import type { CoverPlan } from "./flow";

/**
 * The calls Add a book makes besides saving (which goes through
 * books/store.ts): the lookup and the three cover routes. Every cover call
 * ends in `coverChanged`, so the Library shows the new image at once. Each
 * rejects with an `ApiError`; `network` is the one that means "no answer".
 */

type CallOptions = { signal?: AbortSignal };

/** `POST /api/lookup`: an ISBN (any spelling `parseIsbn` takes) to a draft and the copies already saved. Saves nothing. */
export function lookupIsbn(isbn: string, options: CallOptions = {}): Promise<LookupResponse> {
  return apiRequest("/api/lookup", { ...options, method: "POST", body: { isbn }, schema: lookupResponseSchema });
}

/** `POST /api/books/:id/cover/fetch`: the server downloads a draft's cover candidate and stores it. */
export async function fetchCover(bookId: number, url: string, options: CallOptions = {}): Promise<CoverInfo> {
  const info = await apiRequest(`/api/books/${bookId}/cover/fetch`, {
    ...options,
    method: "POST",
    body: { url },
    schema: coverInfoSchema,
  });
  coverChanged(bookId, info);
  return info;
}

/** `PUT /api/books/:id/cover`: store an image (JPEG, PNG or WebP, 2 MB at most; `resizeImage` makes one). */
export async function uploadCover(bookId: number, image: Blob, options: CallOptions = {}): Promise<CoverInfo> {
  const info = await apiRequest(`/api/books/${bookId}/cover`, { ...options, method: "PUT", body: image, schema: coverInfoSchema });
  coverChanged(bookId, info);
  return info;
}

/** `DELETE /api/books/:id/cover`. A book that already has none counts as done. */
export async function removeCover(bookId: number, options: CallOptions = {}): Promise<void> {
  try {
    await apiRequest(`/api/books/${bookId}/cover`, { ...options, method: "DELETE" });
  } catch (error) {
    if (!isApiError(error, "not_found")) throw error;
  }
  coverChanged(bookId, null);
}

/**
 * One book's stored cover onto another: another copy wears the first copy's
 * cover. `from.coverUpdatedAt` versions the address, so a cache never hands
 * over an older image.
 */
export async function copyCover(
  from: { id: number; coverUpdatedAt: string | null },
  toId: number,
  options: CallOptions = {},
): Promise<CoverInfo> {
  const image = await apiBlob(coverPath(from.id, from.coverUpdatedAt), options);
  return uploadCover(toId, image, options);
}

export type CoverOutcome = "stored" | "none" | "failed";

/**
 * A just-saved book's cover: the owner's photo if there is one, else the
 * draft's candidates in order until one downloads, else the first copy's
 * cover. Never throws: a failed cover never undoes a saved book, it only
 * reports `failed` so the page can say so.
 */
export async function attachCover(bookId: number, plan: CoverPlan, photo: Blob | null): Promise<CoverOutcome> {
  try {
    if (photo !== null) {
      await uploadCover(bookId, photo);
      return "stored";
    }
    switch (plan.kind) {
      case "none":
        return "none";
      case "copy":
        await copyCover({ id: plan.fromId, coverUpdatedAt: plan.coverUpdatedAt }, bookId);
        return "stored";
      case "candidates":
        for (const url of plan.urls) {
          try {
            await fetchCover(bookId, url);
            return "stored";
          } catch (error) {
            // The next candidate may download where this one didn't; a dropped connection won't.
            if (isApiError(error, "network") || isApiError(error, "signed_out")) throw error;
          }
        }
        return "failed";
    }
  } catch {
    return "failed";
  }
}
