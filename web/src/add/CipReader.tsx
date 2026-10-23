import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent } from "react";
import { Button } from "../components/Button";
import { readCipBlock, type CipFields, type CipRead } from "../ocr/block";
import { createOcrReader, downloadSize, OcrLoadError, type OcrReader, type OcrStage } from "../ocr/engine";
import { boxBetween, photoForOcr, type Box, type Point } from "../ocr/image";
import type { FormField } from "./form";
import { AlertIcon, TextScanIcon } from "./icons";
import { ImageReadError } from "./resize";

/**
 * "Read the CIP block" on the by-hand form (brief 30): a photo of the
 * copyright page, an optional box dragged around the block, Tesseract in the
 * browser (ocr/engine.ts), then the description read (ocr/block.ts) and handed
 * to the form, which fills only its empty fields. The text Tesseract read stays
 * under a disclosure, to fix by hand and fill again, or to copy when no block
 * was found. The photo is not kept and never leaves the device.
 */

export interface CipReaderProps {
  /** Fill the form from a read; returns the fields that changed. */
  onRead: (fields: CipFields) => FormField[];
  disabled?: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "photo"; file: File; preview: string; box: Box | null }
  | { kind: "working"; stage: OcrStage | null }
  | { kind: "read"; result: CipRead; changed: FormField[] }
  /** The photo is kept, so "Try again" reads it again once the reader can load. */
  | { kind: "failed"; message: string; file: File; box: Box | null };

const FIELD_NAMES: Record<FormField, string> = { title: "title", author: "author", publisher: "publisher", year: "year", isbn: "ISBN" };

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** "title, author and ISBN". */
function listed(fields: readonly FormField[]): string {
  const names = fields.map((field) => FIELD_NAMES[field]);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function summary(result: CipRead, changed: readonly FormField[]): string {
  if (!result.found) return "No “Descrierea CIP” heading in this photo. Try one closer to the block, or copy the text it read.";
  if (result.fields.title === null) return "Found the CIP block, but no title in it. Fix the text below and fill again.";
  if (changed.length === 0) return "Read the CIP block. The fields it has were already filled.";
  const several = result.isbns.length > 1 ? " It lists several ISBNs: type the one on the back cover." : "";
  return `Filled the ${listed(changed)} from the CIP block. Check them before saving.${several}`;
}

function stageText(stage: OcrStage | null): string {
  if (stage === null) return "Getting the photo ready…";
  switch (stage.stage) {
    case "download":
      return `Downloading the text reader: ${megabytes(stage.loaded)} of ${megabytes(stage.total)}.`;
    case "start":
      return stage.downloading > 0 ? `Downloading the text reader (${megabytes(stage.downloading)})…` : "Starting the text reader…";
    case "read":
      return `Reading the text: ${Math.round(stage.progress * 100)}%.`;
  }
}

/** How far along, 0 to 1, or `null` when it can't be told. */
function stageValue(stage: OcrStage | null): number | null {
  if (stage?.stage === "download") return stage.total > 0 ? stage.loaded / stage.total : null;
  if (stage?.stage === "read") return stage.progress;
  return null;
}

/** The photo, with a box dragged over it (optional): pointer, touch or pen. */
function CropPhoto({ src, box, onBox }: { src: string; box: Box | null; onBox: (box: Box | null) => void }) {
  const start = useRef<Point | null>(null);
  const at = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  return (
    <div
      className="add-cip__photo"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = at(event);
      }}
      onPointerMove={(event) => {
        if (start.current) onBox(boxBetween(start.current, at(event)));
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
    >
      <img src={src} alt="The photo of the copyright page" draggable={false} />
      {box && (
        <span
          className="add-cip__box"
          style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
        />
      )}
    </div>
  );
}

export function CipReader({ onRead, disabled }: CipReaderProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [text, setText] = useState("");
  /** What the first read still downloads, in bytes; `null` until known. */
  const [toDownload, setToDownload] = useState<number | null>(null);
  const reader = useRef<OcrReader | null>(null);
  // A read takes seconds and the owner may type meanwhile: fill with the form as it is when the read ends.
  const latestOnRead = useRef(onRead);
  useEffect(() => {
    latestOnRead.current = onRead;
  });
  /** Bumped by every read and by Cancel: a stale read's progress and result are dropped. */
  const run = useRef(0);

  useEffect(() => {
    let live = true;
    downloadSize().then(
      (bytes) => live && setToDownload(bytes),
      () => {},
    );
    return () => {
      live = false;
      reader.current?.dispose();
    };
  }, []);

  const preview = phase.kind === "photo" ? phase.preview : null;
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared at once, so taking the same file again still counts as a change.
    input.value = "";
    if (file) setPhase({ kind: "photo", file, preview: URL.createObjectURL(file), box: null });
  };

  const read = async (file: File, box: Box | null) => {
    const mine = ++run.current;
    setPhase({ kind: "working", stage: null });
    try {
      const image = await photoForOcr(file, box);
      reader.current ??= createOcrReader();
      const ocr = await reader.current.read(image, (stage) => {
        if (run.current === mine) setPhase({ kind: "working", stage });
      });
      if (run.current !== mine) return;
      const result = readCipBlock(ocr);
      setText(ocr);
      setToDownload(0);
      setPhase({ kind: "read", result, changed: result.found ? latestOnRead.current(result.fields) : [] });
    } catch (error) {
      if (run.current !== mine) return;
      const message =
        error instanceof ImageReadError
          ? error.message
          : error instanceof OcrLoadError
            ? navigator.onLine
              ? "The text reader couldn't load. Try again."
              : "The text reader is downloaded on the first read. Connect and try again."
            : "The photo couldn't be read. Try again.";
      setPhase({ kind: "failed", message, file, box });
    }
  };

  /** Back to the button. The reader stays started, so the next read is quick. */
  const close = () => {
    run.current++;
    setPhase({ kind: "idle" });
  };

  /** Stops a read in progress: the worker is stopped too, and the next read starts a new one. */
  const cancel = () => {
    reader.current?.dispose();
    reader.current = null;
    close();
  };

  const fillAgain = () => {
    if (phase.kind !== "read") return;
    const result = readCipBlock(text);
    setPhase({ ...phase, result, changed: result.found ? onRead(result.fields) : [] });
  };

  const picker = (label: string, primary = false) => (
    <label
      className={`button ${primary ? "button--secondary button--pill" : "button--quiet"} button--compact add-cip__pick`}
      aria-disabled={disabled}
    >
      <input className="visually-hidden" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={pick} />
      {label}
    </label>
  );

  if (phase.kind === "photo") {
    return (
      <div className="add-cip add-cip--open">
        <p className="add-cip__text" role="status">
          Drag a box around the CIP block, or read the whole photo.
        </p>
        <CropPhoto src={phase.preview} box={phase.box} onBox={(box) => setPhase({ ...phase, box })} />
        <div className="add-cip__actions">
          <Button variant="primary" size="compact" disabled={disabled} onClick={() => void read(phase.file, phase.box)}>
            {phase.box ? "Read the box" : "Read the photo"}
          </Button>
          {picker("Retake")}
          <Button variant="quiet" size="compact" className="add-quiet-neutral" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "working") {
    const value = stageValue(phase.stage);
    return (
      <div className="add-cip add-cip--open">
        <p className="add-cip__text" role="status">
          {stageText(phase.stage)}
        </p>
        {value === null ? (
          <div className="add-progress" role="progressbar" aria-label="Reading the CIP block" />
        ) : (
          <div
            className="add-progress add-progress--value"
            role="progressbar"
            aria-label="Reading the CIP block"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value * 100)}
            style={{ "--value": value } as CSSProperties}
          />
        )}
        <div className="add-cip__actions">
          <Button variant="quiet" size="compact" className="add-quiet-neutral" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "read") {
    const { result, changed } = phase;
    return (
      <div className="add-cip add-cip--open">
        <p className={result.found ? "add-cip__text" : "add-cip__text add-error"} role="status">
          {!result.found && <AlertIcon size={16} />}
          {summary(result, changed)}
        </p>
        <details className="add-cip__raw" open={!result.found || result.fields.title === null}>
          <summary>The text read from the photo</summary>
          <textarea
            className="add-cip__ocr"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            spellCheck={false}
            aria-label="The text read from the photo"
          />
          {result.found || /descrierea\s+cip/i.test(text) ? (
            <Button variant="secondary" size="compact" pill disabled={disabled} onClick={fillAgain}>
              Fill from this text
            </Button>
          ) : null}
        </details>
        <div className="add-cip__actions">
          {picker("Read another photo")}
          <Button variant="quiet" size="compact" className="add-quiet-neutral" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-cip">
      <span className="add-cip__icon">
        <TextScanIcon size={22} />
      </span>
      <div className="add-cip__text" role="status">
        {phase.kind === "failed" ? (
          <p className="add-error">
            <AlertIcon size={16} />
            {phase.message}
          </p>
        ) : (
          <p>Fill the fields from the CIP block on the copyright page.</p>
        )}
        {toDownload !== null && toDownload > 0 && (
          <p className="add-hint">The first read downloads {megabytes(toDownload)}; later reads work offline.</p>
        )}
      </div>
      <div className="add-cip__actions">
        {phase.kind === "failed" ? (
          <>
            <Button variant="secondary" size="compact" pill disabled={disabled} onClick={() => void read(phase.file, phase.box)}>
              Try again
            </Button>
            {picker("Another photo")}
          </>
        ) : (
          picker("Read the CIP block", true)
        )}
      </div>
    </div>
  );
}
