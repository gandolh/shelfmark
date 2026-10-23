import { useMemo } from "react";
import { useBooks } from "../books/store";
import { formatPrice, languageName } from "../library/columns";
import { Page } from "../layout/Page";
import { LIBRARY } from "../router";
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
import "./stats.css";

const STATUS_NAMES: Record<string, string> = { unread: "Unread", reading: "Reading", read: "Read", abandoned: "Abandoned" };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Stats (brief 29): reached from the account menu, not a place of its own.
 * Counts of the owned books by author, language, shelf, status and decade,
 * and money spent per year, all worked out here from the books already loaded.
 * A count opens the Library on those books.
 */
export function StatsPage() {
  const { books, status } = useBooks();
  const stats = useMemo(() => computeStats(books), [books]);

  return (
    <Page title="Stats" caption="Owned books only" back={{ to: LIBRARY, label: "Library" }}>
      <div className="stats">
        {status === "loading" && books.length === 0 ? (
          <p className="stats__note">Loading your books…</p>
        ) : stats.owned === 0 ? (
          <p className="stats__note">No owned books yet. Add one and its counts show here.</p>
        ) : (
          <>
            <dl className="stats__totals">
              <Total label="Books owned" value={stats.owned} />
              <Total label="Authors" value={stats.distinctAuthors} />
              <Total label="Shelves in use" value={stats.shelvesInUse} />
            </dl>
            <p className="stats__note">Wishlist: {stats.wishlist}</p>

            <Section title="Authors">
              <List
                rows={stats.authors}
                label={(key) => key}
                filterFor={authorFilter}
                what="by"
              />
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
                <p className="stats__note">No book has both a price and an acquired date yet.</p>
              ) : (
                stats.spending.map((money) => (
                  <table key={money.currency} className="stats__table">
                    <caption className="stats__caption">{money.currency}</caption>
                    <tbody>
                      {money.years.map((row) => (
                        <tr key={row.year}>
                          <th scope="row">{row.year}</th>
                          <td className="stats__detail">{plural(row.books, "book", "books")}</td>
                          <td className="stats__num">{formatPrice(row.totalMinor, money.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))
              )}
              {stats.unpriced > 0 && (
                <p className="stats__foot">
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
    <div className="stats__total">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stats__section">
      <h2 className="stats__heading">{title}</h2>
      {children}
    </section>
  );
}

/** A count that opens the Library on its books; plain text when there is no filter for it. */
function Count({ count, filter, label }: { count: number; filter: LibraryFilter | null; label: string }) {
  if (!filter) return <span className="stats__num">{count}</span>;
  return (
    <button type="button" className="stats__count" aria-label={`${count} ${label}, show in Library`} onClick={() => openInLibrary(filter)}>
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
      <table className="stats__table">
        <tbody>
          {shown.map((row) => (
            <tr key={row.key}>
              <th scope="row">{label(row.key)}</th>
              <td>
                <Count count={row.count} filter={filterFor(row.key)} label={`${what ? `${what} ` : ""}${label(row.key)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 && <p className="stats__foot">and {more} more</p>}
    </>
  );
}

function Rooms({ rooms }: { rooms: readonly Room[] }) {
  const { shown, more } = top(rooms);
  return (
    <>
      <table className="stats__table">
        <tbody>
          {shown.flatMap((room) => {
            const name = room.room === "" ? "No shelf" : room.room;
            const shelves = room.shelves.length > 0 ? room.shelves : null;
            return [
              <tr key={room.room}>
                <th scope="row">{name}</th>
                <td>
                  <Count count={room.count} label={name} filter={shelfFilter(shelves ? shelves.map((s) => s.key) : [room.room])} />
                </td>
              </tr>,
              ...(shelves ?? []).map((shelf) => (
                <tr key={`${room.room}/${shelf.key}`} className="stats__sub">
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
      {more > 0 && <p className="stats__foot">and {more} more</p>}
    </>
  );
}
