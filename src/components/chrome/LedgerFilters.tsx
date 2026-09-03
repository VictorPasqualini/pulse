"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { monthLabel } from "@/lib/dates";
import { BUCKET_LABEL, type Bucket } from "@/lib/types";

/**
 * One row of filters above the table, all of them URL state: a filtered ledger is
 * a link. The text box waits for a pause before navigating so typing stays smooth.
 */

const SELECT =
  "rounded-lg border border-hairline bg-surface-1 px-2.5 py-1.5 text-[12.5px] text-ink outline-none hover:border-hairline-strong";

export function LedgerFilters({
  months,
  segments,
  buckets,
}: {
  months: string[];
  segments: string[];
  buckets: Bucket[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const query = params?.get("q") ?? "";
  const [text, setText] = useState(query);

  useEffect(() => setText(query), [query]);

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`/lancamentos?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (text === query) return;
    const timer = setTimeout(() => push({ q: text }), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const clear = () => startTransition(() => router.push("/lancamentos", { scroll: false }));
  const active = ["mes", "segmento", "tipo", "q"].some((key) => params?.get(key));

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`}>
      <label className="sr-only" htmlFor="ledger-q">
        Buscar na descrição
      </label>
      <input
        id="ledger-q"
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Buscar descrição, conta, ativo…"
        className={`${SELECT} w-full min-w-0 sm:w-64`}
      />

      <label className="sr-only" htmlFor="ledger-month">
        Mês
      </label>
      <select
        id="ledger-month"
        className={SELECT}
        value={params?.get("mes") ?? ""}
        onChange={(event) => push({ mes: event.target.value })}
      >
        <option value="">Todos os meses</option>
        {months.map((month) => (
          <option key={month} value={month}>
            {monthLabel(month, "long")}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="ledger-segment">
        Segmento
      </label>
      <select
        id="ledger-segment"
        className={SELECT}
        value={params?.get("segmento") ?? ""}
        onChange={(event) => push({ segmento: event.target.value })}
      >
        <option value="">Todos os segmentos</option>
        {segments.map((segment) => (
          <option key={segment} value={segment}>
            {segment}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="ledger-bucket">
        Tipo
      </label>
      <select
        id="ledger-bucket"
        className={SELECT}
        value={params?.get("tipo") ?? ""}
        onChange={(event) => push({ tipo: event.target.value })}
      >
        <option value="">Todos os tipos</option>
        {buckets.map((bucket) => (
          <option key={bucket} value={bucket}>
            {BUCKET_LABEL[bucket]}
          </option>
        ))}
      </select>

      {active && (
        <button
          type="button"
          onClick={clear}
          className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
