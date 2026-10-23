import { decode, fitWithin, ImageReadError } from "../add/resize";

/**
 * A photo of a copyright page made ready for Tesseract: upright, cut to the
 * box the owner dragged (if any), and at most `OCR_MAX_SIDE` on the long side.
 * The box maths is separate so it can be tested in Node.
 */

/**
 * The long side Tesseract gets, in px. A phone's 4032 px photo of a whole page
 * still leaves the small CIP type 30 px tall or more at this size, and a phone
 * has the memory for it.
 */
export const OCR_MAX_SIDE = 2400;

/** A part of the photo, in fractions of its width and height (0 to 1). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Under this share of a side, a drag is taken for a tap and leaves no box. */
const MIN_SIDE = 0.04;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** The box between where a drag started and where it is now, in fractions of the shown photo, kept inside it. */
export function boxBetween(start: Point, end: Point): Box | null {
  const [x0, x1] = [clamp(start.x), clamp(end.x)].sort((a, b) => a - b) as [number, number];
  const [y0, y1] = [clamp(start.y), clamp(end.y)].sort((a, b) => a - b) as [number, number];
  if (x1 - x0 < MIN_SIDE || y1 - y0 < MIN_SIDE) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The box in the photo's own pixels, whole pixels, never empty; the whole photo when there is no box. */
export function boxInPixels(box: Box | null, width: number, height: number): { x: number; y: number; width: number; height: number } {
  if (box === null) return { x: 0, y: 0, width, height };
  const x = Math.min(width - 1, Math.round(box.x * width));
  const y = Math.min(height - 1, Math.round(box.y * height));
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round(box.width * width))),
    height: Math.max(1, Math.min(height - y, Math.round(box.height * height))),
  };
}

/** The photo, cut to `box`, on a canvas no longer than `OCR_MAX_SIDE`: what `recognize` is given. */
export async function photoForOcr(file: Blob, box: Box | null): Promise<HTMLCanvasElement> {
  const { image, width, height, release } = await decode(file);
  try {
    if (width === 0 || height === 0) throw new ImageReadError("This picture is empty.");
    const part = boxInPixels(box, width, height);
    const size = fitWithin(part.width, part.height, OCR_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null) throw new ImageReadError("This browser can't read pictures.");
    context.fillStyle = "white";
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, part.x, part.y, part.width, part.height, 0, 0, size.width, size.height);
    return canvas;
  } finally {
    release();
  }
}
