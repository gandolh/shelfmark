import { COVER_MAX_BYTES } from "@shelfmark/shared";

/**
 * A photo of a cover, made small enough to store: at most 900 px on the long
 * side, JPEG, under the server's 2 MB. The maths is separate from the canvas
 * so it can be tested in Node; `resizeImage` is the browser half.
 */

/** The long side of a stored cover photo, in px. */
export const COVER_MAX_SIDE = 900;

/** JPEG qualities to try, best first, until the file fits under the cap. */
export const JPEG_QUALITIES = [0.85, 0.72, 0.6, 0.45] as const;

export interface Size {
  width: number;
  height: number;
}

/** The size that fits `maxSide` on the long side, keeping the shape. Never larger than the original. */
export function fitWithin(width: number, height: number, maxSide: number = COVER_MAX_SIDE): Size {
  if (!(width > 0 && height > 0 && maxSide > 0)) throw new RangeError("fitWithin needs positive sizes");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The sizes to draw through on the way down: halving while the image is more
 * than twice the target, then the target. One big jump (a 4032 px phone photo
 * straight to 900) skips pixels and leaves the type on a cover jagged.
 */
export function downscaleSteps(width: number, height: number, maxSide: number = COVER_MAX_SIDE): Size[] {
  const target = fitWithin(width, height, maxSide);
  const long = (size: Size) => Math.max(size.width, size.height);
  const steps: Size[] = [];
  let current: Size = { width, height };
  // A last step under 10% isn't worth a canvas of its own.
  while (long(current) / 2 > long(target) * 1.1) {
    current = { width: Math.round(current.width / 2), height: Math.round(current.height / 2) };
    steps.push(current);
  }
  steps.push(target);
  return steps;
}

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export class ImageReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImageReadError";
  }
}

export type Drawable = ImageBitmap | HTMLImageElement;

/**
 * Decode an image file, upright: `createImageBitmap` applies the photo's EXIF
 * rotation; `<img>` is the fallback (older Safari, HEIC). Also read by
 * ocr/image.ts for a photo of a CIP block.
 */
export async function decode(file: Blob): Promise<{ image: Drawable; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which decodes more formats on Safari.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new ImageReadError("This file isn't a picture the browser can read.", { cause: error });
  }
  return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function canvasOf(size: Size): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Resize a photo or image file for `PUT /api/books/:id/cover`: at most
 * `maxSide` on the long side, a JPEG on the page's `--surface` (a transparent
 * PNG would otherwise turn black), at the best quality that fits `maxBytes`.
 */
export async function resizeImage(
  file: Blob,
  { maxSide = COVER_MAX_SIDE, maxBytes = COVER_MAX_BYTES }: { maxSide?: number; maxBytes?: number } = {},
): Promise<ResizedImage> {
  const { image, width, height, release } = await decode(file);
  try {
    if (width === 0 || height === 0) throw new ImageReadError("This picture is empty.");

    let source: CanvasImageSource = image;
    let canvas: HTMLCanvasElement | null = null;
    for (const size of downscaleSteps(width, height, maxSide)) {
      canvas = canvasOf(size);
      const context = canvas.getContext("2d");
      if (context === null) throw new ImageReadError("This browser can't resize pictures.");
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "white";
      context.fillRect(0, 0, size.width, size.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, size.width, size.height);
      source = canvas;
    }
    if (canvas === null) throw new ImageReadError("This picture is empty.");

    for (const quality of JPEG_QUALITIES) {
      const blob = await toBlob(canvas, quality);
      if (blob === null) break;
      if (blob.size <= maxBytes) return { blob, width: canvas.width, height: canvas.height };
    }
    throw new ImageReadError("This picture stays too large to store, even made smaller.");
  } finally {
    release();
  }
}
