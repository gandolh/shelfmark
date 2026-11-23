import { useMemo } from "react";
import { useBooks } from "../books/store";
import { ButtonLink } from "../components/Button";
import { Page } from "../layout/Page";
import { useIsDesktop } from "../layout/viewport";
import { LibraryMessage } from "../library/LibraryStates";
import { CoversGrid } from "../library/CoversGrid";
import { NO_SELECTION } from "../library/selection";
import { ADD_TO_WISHLIST } from "../router";
import { Recommendations } from "./Recommendations";
import { useRecommendations } from "./useRecommendations";

const noop = () => undefined;

/**
 * Wishlist, the third place (decisions.md, 2026-11-10): the books wished for,
 * then the recommendations. A recommendation is never a book already in the
 * database, in either collection or dismissed.
 */
export function WishlistPage() {
  const desktop = useIsDesktop();
  const { books, status } = useBooks();
  const wished = useMemo(() => books.filter((book) => book.collection === "wishlist"), [books]);
  const recs = useRecommendations();

  return (
    <Page
      title="Wishlist"
      caption={status === "ready" ? `${wished.length.toLocaleString("en-GB")} wished for` : undefined}
      toolbar={
        <ButtonLink to={ADD_TO_WISHLIST} variant="primary" size={desktop ? "regular" : "large"}>
          Add a book
        </ButtonLink>
      }
      card
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="wished-heading">
          <h2 id="wished-heading" className="mb-3 font-book text-heading leading-heading font-semibold">
            Wished for
          </h2>
          {status === "loading" ? null : wished.length === 0 ? (
            <LibraryMessage
              title="Your wishlist is empty"
              action={
                <ButtonLink to={ADD_TO_WISHLIST} variant="primary" size={desktop ? "regular" : "large"}>
                  Add a book
                </ButtonLink>
              }
            >
              Add a book you hear about, or one of the recommendations below. “I bought it” on a book moves it to your
              library.
            </LibraryMessage>
          ) : (
            <CoversGrid
              rows={wished}
              pageStart={0}
              total={wished.length}
              layout={desktop ? "desktop" : "phone"}
              selecting={false}
              selection={NO_SELECTION}
              onPress={noop}
              onToggle={noop}
            />
          )}
        </section>
        <Recommendations recs={recs} />
      </div>
    </Page>
  );
}
