"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  id?: string;
}

const inputBase =
  "min-h-[44px] w-full rounded-lg border border-border bg-paper px-3 text-base text-ink placeholder:text-ink-50 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1 disabled:bg-bone-100 disabled:text-ink-50";

/**
 * A visible-suggestions text combobox — replaces `<datalist>` for the
 * TCDB-backed player-name field (ManualCorrectionForm). `<datalist>`'s
 * mobile support is poor/inconsistent, especially iOS Safari (suggestions
 * often don't render, or render outside any styleable/keyboard-navigable
 * UI). This renders its own listbox instead, so suggestions are always
 * visible and keyboard/touch operable regardless of platform.
 */
export function Combobox({ label, value, onChange, suggestions, placeholder, hint, error, required, id }: ComboboxProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const showList = open && suggestions.length > 0;

  function selectSuggestion(s: string) {
    onChange(s);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden="true" className="text-plum"> *</span>}
      </label>
      <input
        id={fieldId}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        required={required}
        aria-invalid={!!error}
        className={cn(inputBase)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-paper py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "min-h-[44px] cursor-pointer px-3 py-2 text-sm text-ink flex items-center",
                i === activeIndex ? "bg-bone-100" : "hover:bg-bone-100",
              )}
              // onMouseDown (not onClick) so this fires before the input's
              // onBlur/outside-click handler would otherwise close the list
              // first and swallow the selection.
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      {hint && !error && <p className="text-xs text-ink-50">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
