import type { Reader, Status } from "@shelfmark/shared";
import { STATUS_LABELS } from "../add/StatusPicker";
import { formatAdded } from "../library/columns";
import { StarIcon } from "./RatingField";

/** As the Library's Status column sets them: "Reading" is the one coloured status. */
const STATUS_TONE: Record<Status, string> = {
  reading: "font-semibold text-accent",
  read: "text-ink-2",
  unread: "text-muted",
  abandoned: "text-muted",
};

function Dot() {
  return (
    <span className="text-muted" aria-hidden="true">
      {" · "}
    </span>
  );
}

/**
 * Everyone else's status and rating on the book, under the signed-in
 * person's own: one line each, "Ana · Read · ★★★★☆ · 12 Oct". Nothing when
 * nobody else has one. A long name wraps; it is never cut.
 */
export function OtherReaders({ readers }: { readers: readonly Reader[] }) {
  if (readers.length === 0) return null;
  return (
    <ul aria-label="Other readers" className="flex flex-col gap-1 text-meta leading-body text-ink-2">
      {readers.map((reader) => (
        <li key={reader.userId} className="min-w-0 wrap-anywhere">
          <span className="font-semibold text-ink">{reader.username}</span>
          <Dot />
          <span className={STATUS_TONE[reader.status]}>{STATUS_LABELS[reader.status]}</span>
          {reader.rating !== null && (
            <>
              <Dot />
              <span
                role="img"
                aria-label={`${reader.rating} of 5 stars`}
                className="inline-flex gap-px align-middle text-accent"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} on={n <= (reader.rating ?? 0)} size={14} />
                ))}
              </span>
            </>
          )}
          <Dot />
          <time className="text-muted" dateTime={reader.updatedAt}>
            {formatAdded(reader.updatedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
