"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buildSuggestions, isTypeaheadReady, type Suggestion } from "@/lib/search-suggest";

/**
 * Header search typeahead (round 6, R6-2; PRD FR-101/FR-104): debounced
 * (≤250 ms) client island over the rate-limited `/api/search/typeahead`
 * contract, with the ARIA 1.2 combobox pattern — `role=listbox` suggestions,
 * ArrowUp/ArrowDown active-descendant movement, Enter selects, Escape
 * dismisses, bare submit lands on the shareable `/search?q=` page (FR-106).
 * Suggestions come from the pure `buildSuggestions` helper; fetches abort on
 * change/unmount so fast typing never races stale responses. Dropdown
 * visibility is DERIVED (focused × ready × has-options) — no effect-body
 * setState (react-hooks/set-state-in-effect).
 */

const DEBOUNCE_MS = 250;

export function SearchTrigger() {
  const router = useRouter();
  const listboxId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const ready = isTypeaheadReady(query);
  const open = focused && ready && options.length > 0;

  useEffect(() => {
    if (!ready) {
      // Sub-minimum query: cancel any pending work. Option state clears via
      // the fetch callback only; the derived `open` closes the dropdown.
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/search/typeahead?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then(async (res) => (res.ok ? res.json() : { products: [], categories: [], journal: [] }))
        .then((body: unknown) => {
          const shaped = buildSuggestions(body as Parameters<typeof buildSuggestions>[0]);
          setOptions(shaped.groups.flatMap((g) => g.items));
        })
        .catch((error: unknown) => {
          if ((error as Error).name !== "AbortError") {
            console.error("[search-trigger] typeahead fetch failed", error);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, ready]);

  // Abort in-flight work on unmount (fetch + timer are external systems).
  useEffect(() => () => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const go = useCallback(
    (suggestion: Suggestion) => {
      setFocused(false);
      setActiveIndex(-1);
      setQuery("");
      router.push(suggestion.href);
    },
    [router],
  );

  const submit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setFocused(false);
    setActiveIndex(-1);
    setQuery("");
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [query, router]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open || options.length === 0) return;
      setActiveIndex((i) => (i + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open || options.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = open && activeIndex >= 0 ? options[activeIndex] : undefined;
      if (picked) go(picked);
      else submit();
    }
  };

  const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-pill border border-line bg-bg px-4 text-sm focus-within:border-ring">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search"
          placeholder="Search furniture, lighting…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          className="w-40 bg-transparent text-ink placeholder:text-muted focus:outline-none lg:w-56"
        />
      </div>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute right-0 top-13 z-50 w-80 max-w-[90vw] rounded-card border border-line bg-bg p-2 shadow-lg"
        >
          {options.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.href}`}
              id={`${listboxId}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                // mousedown (not click) so blur never races the navigation.
                e.preventDefault();
                go(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-pill px-4 py-3 text-sm ${
                index === activeIndex ? "bg-bg-3 text-ink" : "text-ink-2"
              }`}
            >
              <span className="truncate">{suggestion.label}</span>
              <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
                {suggestion.kind === "product" ? "Product" : "Category"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
