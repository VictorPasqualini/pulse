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

  const index = months.indexOf(current);
  const step = (delta: number) => {
    const target = months[index + delta];
    if (target) go(target);
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border border-hairline bg-surface-1 p-0.5 ${pending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={index <= 0}
        aria-label="Mês anterior"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <span aria-hidden>‹</span>
      </button>

      <label className="sr-only" htmlFor="pulse-month">
        Mês de referência
      </label>
      <select
        id="pulse-month"
        value={current}
        onChange={(event) => go(event.target.value)}
        className="min-w-[9.5rem] appearance-none rounded-md bg-transparent px-2 py-1 text-center text-[13px] font-medium text-ink outline-none"
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {monthLabel(month, "long")}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={index < 0 || index >= months.length - 1}
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
