"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { monthLabel } from "@/lib/dates";

/**
 * The one filter row that sits above the charts: which month, and a reload that
 * bypasses the cache. Both write to the URL or the server, never to component
 * state, so a filtered view is a link you can send to yourself.
 */

export function MonthPicker({ months, current }: { months: string[]; current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (months.length === 0) return null;

  const go = (month: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("mes", month);
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  };

  /**
   * `months` arrives newest-first — the right order for a dropdown, where the month
   * you want is almost always a recent one, and the wrong order for the arrows: a
   * lower index is a *newer* month, so walking the index up is walking back in time.
   * Naming the two neighbours instead of stepping by ±1 keeps ‹ pointing at the past
   * whichever way the list happens to be sorted.
   */
  const index = months.indexOf(current);
  const older = index >= 0 ? months[index + 1] : undefined;
  const newer = index > 0 ? months[index - 1] : undefined;

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border border-hairline bg-surface-1 p-0.5 ${pending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={() => older && go(older)}
        disabled={!older}
        aria-label="Mês anterior"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <span aria-hidden>‹</span>
      </button>

      <label className="sr-only" htmlFor="pulse-month">
        Mês de referência
      </label>
      {/* The colours are explicit, on the select *and* on every option: the open
          dropdown is drawn by the browser, and it paints the list in the control's
          own background. A transparent control means a white list — with white ink
          on it in dark mode, which is an invisible menu. `color-scheme: dark` does
          not save it, because a declared background wins over the UA's. */}
      <select
        id="pulse-month"
        value={current}
        onChange={(event) => go(event.target.value)}
        className="min-w-[9.5rem] appearance-none rounded-md bg-surface-1 px-2 py-1 text-center text-[13px] font-medium text-ink outline-none"
      >
        {months.map((month) => (
          <option key={month} value={month} className="bg-surface-1 text-ink">
            {monthLabel(month, "long")}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => newer && go(newer)}
        disabled={!newer}
        aria-label="Mês seguinte"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}

export function SyncButton({ fetchedLabel }: { fetchedLabel?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const sync = async () => {
    setState("loading");
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      {fetchedLabel && state === "idle" && (
        <span className="hidden text-[11.5px] text-ink-3 sm:inline">{fetchedLabel}</span>
      )}
      {state === "error" && <span className="text-[11.5px] text-bad">Falha ao atualizar</span>}
      <button
        type="button"
        onClick={sync}
        disabled={state === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" />
          <path d="M13.6 1.9v2.6h-2.6" />
        </svg>
        {state === "loading" ? "Atualizando…" : "Atualizar"}
      </button>
    </div>
  );
}
