import { buttonClass } from "../components/Button";
import { COVER_CLASS } from "../components/CoverImage";
import { cn } from "../lib/cn";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { AlertIcon, CameraIcon } from "./icons";
import { ImageReadError, resizeImage } from "./resize";

/** A cover photo ready to upload: already resized, with a `data:` URL to show it before it is stored. */
export interface CoverPhoto {
  blob: Blob;
  width: number;
  height: number;
  /** A `data:` URL: nothing to revoke when the photo is dropped. */
  preview: string;
}

export interface CoverCaptureProps {
  photo: CoverPhoto | null;
  onChange: (photo: CoverPhoto | null) => void;
  /** What the box says while there is no photo. Default "No cover found. Take a photo of the front." */
  prompt?: ReactNode;
  disabled?: boolean;
  className?: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The photo couldn't be read."));
    reader.readAsDataURL(blob);
  });
}

/**
 * "Take a photo of the front": a file input that opens the rear camera on a
 * phone (`capture="environment"`) and a file picker elsewhere. The image is
 * resized to 900 px on the long side, as a JPEG, before it reaches the
 * parent, which uploads it whenever it likes (after the save on Add a book,
 * at once on the book page). Uploading is not this component's job.
 */
export function CoverCapture({
  photo,
  onChange,
  prompt = "No cover found. Take a photo of the front.",
  disabled,
  className,
}: CoverCaptureProps) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared at once, so taking the same file again still counts as a change.
    input.value = "";
    if (!file) return;
    setWorking(true);
    setProblem(null);
    try {
      const resized = await resizeImage(file);
      onChange({ ...resized, preview: await readAsDataUrl(resized.blob) });
    } catch (error) {
      setProblem(error instanceof ImageReadError ? error.message : "That photo couldn't be used. Try another.");
    } finally {
      setWorking(false);
    }
  };

  const picker = (label: string) => (
    <label
      className={buttonClass({ variant: "secondary", size: "compact", pill: true })}
      aria-disabled={disabled || working}
    >
      <input
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || working}
        onChange={(event) => void pick(event)}
      />
      {label}
    </label>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-menu pt-2.5 pr-2.5 pb-2.5 pl-3 [outline:1.5px_dashed_color-mix(in_srgb,var(--color-muted)_55%,transparent)] outline-offset-[-1.5px]",
        photo ? "outline-divider [outline-style:solid]" : null,
        className,
      )}
    >
      {photo ? (
        <span className={cn(COVER_CLASS, "[--cover-width:36px]")}>
          <img className="size-full object-cover" src={photo.preview} alt="" />
        </span>
      ) : (
        <span className="flex flex-none text-muted">
          <CameraIcon size={22} />
        </span>
      )}
      <div className="min-w-0 flex-1 text-meta leading-tight text-ink-2" role="status">
        {working ? (
          <p>Making the photo smaller…</p>
        ) : problem ? (
          <p className="flex items-start gap-1.5 text-small leading-tight font-semibold text-ink [&_svg]:-mt-0.25 [&_svg]:flex-none">
            <AlertIcon size={16} />
            {problem}
          </p>
        ) : photo ? (
          <p>Photo of the front, for the cover.</p>
        ) : (
          <p>{prompt}</p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1">
        {photo ? (
          <>
            {picker("Retake")}
            <button
              type="button"
              className={buttonClass(
                { variant: "quiet", size: "compact" },
                "text-ink-2 hover:text-ink active:text-ink",
              )}
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </>
        ) : (
          picker("Photo")
        )}
      </div>
    </div>
  );
}
