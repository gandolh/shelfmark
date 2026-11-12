import { useMemo } from "react";
import { useBooks } from "../books/store";
import { formatPrice, languageName } from "../library/columns";
import { Page } from "../layout/Page";
import { Link } from "../components/Link";
import { LIBRARY, WISHLIST } from "../router";
import { computeStats, top, UNKNOWN_YEAR, type Room, type Tally } from "./count";
import {
  authorFilter,
  decadeFilter,
  languageFilter,
  openInLibrary,
  shelfFilter,
  statusFilter,
  type LibraryFilter,
} from "./links";

const STATUS_NAMES: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  abandoned: "Abandoned",
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Stats: reached from the account menu, not a place of its own.
 * Counts of the owned books by author, language, shelf, status and decade,
 * and money spent per year, all worked out here from the books already loaded.
 * A count opens the Library on those books.
 */
// A table on a white card: left-aligned cells on divider rules, the last column right-aligned, no rule under the last row.
const TABLE =
  "w-full border-collapse bg-surface rounded-container text-body [&_th]:py-2.5 [&_th]:px-4 [&_th]:border-b [&_th]:border-divider [&_th]:text-left [&_th]:font-regular [&_td]:py-2.5 [&_td]:px-4 [&_td]:border-b [&_td]:border-divider [&_td]:text-left [&_td]:font-regular last:[&_td]:text-right last:[&_td]:tabular-nums [&_tr:last-child>*]:border-b-0";

export function StatsPage() {
  const { books, status } = useBooks();
  const stats = useMemo(() => computeStats(books), [books]);

  return (
    <Page title="Stats" caption="Owned books only" back={{ to: LIBRARY, label: "Library" }}>
      <div className="flex max-w-page flex-col gap-5">
        {status === "loading" && books.length === 0 ? (
          <p className="text-meta text-muted">Loading your books…</p>
        ) : stats.owned === 0 ? (
          <p className="text-meta text-muted">No owned books yet. Add one and its counts show here.</p>
        ) : (
          <>
            <dl className="flex flex-wrap gap-3">
              <Total label="Books owned" value={stats.owned} />
              <Total label="Authors" value={stats.distinctAuthors} />
              <Total label="Shelves in use" value={stats.shelvesInUse} />
            </dl>
            <p className="text-meta text-muted">
              <Link to={WISHLIST}>Wishlist: {stats.wishlist}</Link>
            </p>

            <Section title="Authors">
              <List rows={stats.authors} label={(key) => key} filterFor={authorFilter} what="by" />
            </Section>
            <Section title="Languages">
              <List
                rows={stats.languages}
                label={(key) => (key === "" ? "No language" : languageName(key))}
                filterFor={languageFilter}
              />
            </Section>
            <Section title="Shelves">
              <Rooms rooms={stats.rooms} />
            </Section>
            <Section title="Status">
              <List rows={stats.statuses} label={(key) => STATUS_NAMES[key] ?? key} filterFor={statusFilter} />
            </Section>
            <Section title="Decades">
              <List
                rows={stats.decades}
                label={(key) => (key === UNKNOWN_YEAR ? "Unknown year" : `${key}s`)}
                filterFor={decadeFilter}
              />
            </Section>
            <Section title="Spent per year">
              {stats.spending.length === 0 ? (
                <p className="text-meta text-muted">No book has both a price and an acquired date yet.</p>
              ) : (
                stats.spending.map((money) => (
                  <table key={money.currency} className={TABLE}>
                    <caption className="bg-surface pt-2.5 pr-4 pl-4 text-left text-label font-semibold text-muted">
                      {money.currency}
                    </caption>
                    <tbody>
                      {money.years.map((row) => (
                        <tr key={row.year}>
                          <th scope="row">{row.year}</th>
                          <td className="text-meta text-muted">{plural(row.books, "book", "books")}</td>
                          <td>{formatPrice(row.totalMinor, money.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))
              )}
              {stats.unpriced > 0 && (
                <p className="text-meta text-muted">
                  {plural(stats.unpriced, "book has", "books have")} no price or no acquired date, so{" "}
                  {stats.unpriced === 1 ? "it isn't" : "they aren't"} counted here.
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </Page>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-[1_1_140px] rounded-container bg-surface px-5 py-4 [&_dd]:mt-1 [&_dd]:text-title-phone [&_dd]:font-bold [&_dd]:tabular-nums [&_dt]:text-label [&_dt]:font-semibold [&_dt]:text-muted">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-row-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A count that opens the Library on its books; plain text when there is no filter for it. */
function Count({ count, filter, label }: { count: number; filter: LibraryFilter | null; label: string }) {
  if (!filter) return <span>{count}</span>;
  return (
    <button
      type="button"
      className="-my-3 min-h-11 min-w-11 cursor-pointer px-1 text-accent tabular-nums hover:text-accent-press hover:underline"
      aria-label={`${count} ${label}, show in Library`}
      onClick={() => openInLibrary(filter)}
    >
      {count}
    </button>
  );
}

function List({
  rows,
  label,
  filterFor,
  what,
}: {
  rows: readonly Tally[];
  label: (key: string) => string;
  filterFor: (key: string) => LibraryFilter | null;
  what?: string;
}) {
  const { shown, more } = top(rows);
  return (
    <>
      <table className={TABLE}>
        <tbody>
          {shown.map((row) => (
            <tr key={row.key}>
              <th scope="row">{label(row.key)}</th>
              <td>
                <Count
                  count={row.count}
                  filter={filterFor(row.key)}
                  label={`${what ? `${what} ` : ""}${label(row.key)}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 && <p className="text-meta text-muted">and {more} more</p>}
    </>
  );
}

function Rooms({ rooms }: { rooms: readonly Room[] }) {
  const { shown, more } = top(rooms);
  return (
    <>
      <table className={TABLE}>
        <tbody>
          {shown.flatMap((room) => {
            const name = room.room === "" ? "No shelf" : room.room;
            const shelves = room.shelves.length > 0 ? room.shelves : null;
            return [
              <tr key={room.room}>
                <th scope="row">{name}</th>
                <td>
                  <Count
                    count={room.count}
                    label={name}
                    filter={shelfFilter(shelves ? shelves.map((s) => s.key) : [room.room])}
                  />
                </td>
              </tr>,
              ...(shelves ?? []).map((shelf) => (
                <tr key={`${room.room}/${shelf.key}`} className="[&_th]:pl-8 [&_th]:text-ink-2">
                  <th scope="row">{shelf.key}</th>
                  <td>
                    <Count count={shelf.count} label={shelf.key} filter={shelfFilter([shelf.key])} />
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
      {more > 0 && <p className="text-meta text-muted">and {more} more</p>}
    </>
  );
}
