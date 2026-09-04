"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "dark" | "light";

const KEY = "pulse-theme";

/**
 * Dark and light are two designed palettes, not an inversion, so the toggle has
 * three states and "system" is a real one — it hands the choice back to the OS.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") setChoice(saved);
    } catch {
      /* private mode: stay on system */
    }
  }, []);

  const apply = (next: Choice) => {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* nothing to persist to; the class is already applied */
    }
  };

  const options: { value: Choice; label: string; glyph: string }[] = [
    { value: "light", label: "Tema claro", glyph: "☀" },
    { value: "system", label: "Seguir o sistema", glyph: "◐" },
    { value: "dark", label: "Tema escuro", glyph: "☾" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex items-center gap-0.5 rounded-full border border-hairline p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={choice === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => apply(option.value)}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition-colors ${
            choice === option.value ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          <span aria-hidden>{option.glyph}</span>
        </button>
      ))}
    </div>
  );
}
