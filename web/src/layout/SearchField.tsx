import { useEffect, useId, useRef } from "react";
import { cn } from "../lib/cn";
import { ClearIcon, SearchIcon } from "../components/icons";
import { LIBRARY, navigate, useRoute } from "../router";
import { setSearchQuery, useSearchQuery } from "./search";

/**
 * The Library's search box. In the top bar on the desktop (where it searches
 * from any page: typing takes you to the Library), and under the title of a
 * phone page that asks for it. `/` focuses it from anywhere but a field;
 * Escape clears it, then leaves it.
 */
export function SearchField({
  placement,
  placeholder = "Search",
}: {
  placement: "bar" | "header";
  placeholder?: string;
}) {
  const query = useSearchQuery();
  const route = useRoute();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]"))
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const change = (value: string) => {
    setSearchQuery(value);
    if (value.trim() !== "" && route.name !== "library") navigate(LIBRARY);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-field bg-field px-2.5 text-muted focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-focus-ring",
        placement === "bar" ? "min-h-control flex-[0_1_240px]" : "min-h-10",
      )}
      role="search"
    >
      <label htmlFor={id} className="flex flex-none cursor-text">
        <SearchIcon size={placement === "bar" ? 15 : 16} />
        <span className="sr-only">Search books</span>
      </label>
      <input
        ref={input}
        id={id}
        className={cn(
          "h-control min-w-0 flex-1 appearance-none bg-transparent text-meta text-ink focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          placement === "header" && "h-10 text-input-phone",
        )}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          if (query !== "") change("");
          else event.currentTarget.blur();
        }}
      />
      {query !== "" && (
        <button
          type="button"
          className="relative flex size-4.5 flex-none items-center justify-center rounded-pill bg-muted text-field before:absolute before:-inset-3.25 before:content-[''] hover:bg-ink-2"
          aria-label="Clear search"
          onClick={() => {
            change("");
            input.current?.focus();
          }}
        >
          <ClearIcon size={12} />
        </button>
      )}
    </div>
  );
}
