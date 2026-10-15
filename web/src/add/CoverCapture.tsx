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

  const picker = (label: string, look: string) => (
    <label className={`button button--secondary button--compact button--pill add-cover__pick ${look}`} aria-disabled={disabled || working}>
      <input
        className="visually-hidden"
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
    <div className={["add-cover", photo ? "add-cover--taken" : null, className].filter(Boolean).join(" ")}>
      {photo ? (
        <span className="cover cover--image add-cover__thumb">
          <img className="cover__img" src={photo.preview} alt="" />
        </span>
      ) : (
        <span className="add-cover__icon">
          <CameraIcon size={22} />
        </span>
      )}
      <div className="add-cover__text" role="status">
        {working ? (
          <p>Making the photo smaller…</p>
        ) : problem ? (
          <p className="add-error">
            <AlertIcon size={16} />
            {problem}
          </p>
        ) : photo ? (
          <p>Photo of the front, for the cover.</p>
        ) : (
          <p>{prompt}</p>
        )}
      </div>
      <div className="add-cover__actions">
        {photo ? (
          <>
            {picker("Retake", "add-cover__retake")}
            <button
              type="button"
              className="button button--quiet button--compact add-quiet-neutral"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </>
        ) : (
          picker("Photo", "")
        )}
      </div>
    </div>
  );
}
