import { useEffect, useId, useRef } from "react";
import { ClearIcon, SearchIcon } from "../components/icons";
import { LIBRARY, navigate, useRoute } from "../router";
import { setSearchQuery, useSearchQuery } from "./search";

/**
 * The Library's search box. In the top bar on the desktop (where it searches
 * from any page: typing takes you to the Library), and under the title of a
 * phone page that asks for it. `/` focuses it from anywhere but a field;
 * Escape clears it, then leaves it.
 */
export function SearchField({ placement, placeholder = "Search" }: { placement: "bar" | "header"; placeholder?: string }) {
  const query = useSearchQuery();
  const route = useRoute();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
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
    <div className={`search search--${placement}`} role="search">
      <label htmlFor={id} className="search__icon">
        <SearchIcon size={placement === "bar" ? 15 : 16} />
        <span className="visually-hidden">Search books</span>
      </label>
      <input
        ref={input}
        id={id}
        className="search__input"
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
          className="search__clear"
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
