import type { Metadata } from "next";
import { Suspense } from "react";
import { loadDataset } from "@/lib/source";
import { availableMonths } from "@/lib/metrics";
import { brl, brlSigned } from "@/lib/money";
import { fullDateLabel, monthKey, relativeFromNow } from "@/lib/dates";
import { fold } from "@/lib/text";
import { BUCKET_LABEL, type Bucket, type Transaction } from "@/lib/types";
import { PageHeader, PageShell } from "@/components/chrome/PageHeader";
import { SyncButton } from "@/components/chrome/Toolbar";
import { LedgerFilters } from "@/components/chrome/LedgerFilters";
import { LoadError, Unconfigured } from "@/components/chrome/DataState";
import { Card, CardHeader, Empty, Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lançamentos",
  description: "Todas as linhas da planilha, filtráveis por mês, segmento e tipo.",
};

const PAGE_SIZE = 300;

const BUCKET_ORDER: Bucket[] = [
  "income",
  "expense",
  "invest_contrib",
  "invest_withdraw",
  "invest_yield",
];

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; segmento?: string; tipo?: string; q?: string }>;
}) {
  const [query, result] = await Promise.all([searchParams, loadDataset()]);

  if (result.status === "unconfigured") {
    return (
      <PageShell>
        <Unconfigured />
      </PageShell>
    );
  }

  if (result.status === "error") {
    return (
      <PageShell>
        <PageHeader title="Lançamentos" />
        <LoadError message={result.message} hint={result.hint} />
      </PageShell>
    );
  }

  const { transactions, fetchedAt, issues } = result.dataset;
  const months = availableMonths(transactions);
  const segments = [...new Set(transactions.map((tx) => tx.segment))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const needle = query.q ? fold(query.q) : "";
  const filtered = transactions
    .filter((tx) => !query.mes || monthKey(tx.date) === query.mes)
    .filter((tx) => !query.segmento || tx.segment === query.segmento)
    .filter((tx) => !query.tipo || tx.bucket === query.tipo)
    .filter((tx) => !needle || matches(tx, needle))
    .sort((a, b) => (a.date === b.date ? b.row - a.row : b.date.localeCompare(a.date)));

  const income = sum(filtered, "income");
  const expense = sum(filtered, "expense");
  const contrib = sum(filtered, "invest_contrib");

  return (
    <PageShell>
      <PageHeader
        title="Lançamentos"
        subtitle="A planilha inteira, linha por linha — é aqui que dá para conferir qualquer número do painel."
        actions={<SyncButton fetchedLabel={`Lido ${relativeFromNow(fetchedAt)}`} />}
        filters={
          <Suspense fallback={<div className="h-8" />}>
            <LedgerFilters months={months} segments={segments} buckets={BUCKET_ORDER} />
          </Suspense>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        <span className="text-ink-2">
          <strong className="tnum font-semibold text-ink">{filtered.length}</strong> lançamentos
        </span>
        <span className="text-ink-2">
          Entradas <span className="tnum font-medium text-ink">{brl(income)}</span>
        </span>
        <span className="text-ink-2">
          Saídas <span className="tnum font-medium text-ink">{brl(expense)}</span>
        </span>
        {contrib > 0 && (
          <span className="text-ink-2">
            Aportes <span className="tnum font-medium text-ink">{brl(contrib)}</span>
          </span>
        )}
        <span className="text-ink-2">
          Saldo{" "}
          <span className={`tnum font-medium ${income - expense >= 0 ? "text-good" : "text-bad"}`}>
            {brlSigned(income - expense)}
          </span>
        </span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty title="Nenhum lançamento com esses filtros.">
            <p>Tente limpar a busca ou escolher outro mês.</p>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[11.5px] text-ink-3">
                  <th className="py-2.5 pr-3 pl-5 font-medium">Data</th>
                  <th className="py-2.5 pr-3 font-medium">Descrição</th>
                  <th className="py-2.5 pr-3 font-medium">Segmento</th>
                  <th className="py-2.5 pr-3 font-medium">Tipo</th>
                  <th className="py-2.5 pr-3 font-medium">Conta / cartão</th>
                  <th className="py-2.5 pr-5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, PAGE_SIZE).map((tx) => (
                  <tr key={tx.id} className="border-b border-hairline last:border-0">
                    <td className="tnum py-2.5 pr-3 pl-5 whitespace-nowrap text-ink-3">
                      {fullDateLabel(tx.date)}
                    </td>
                    <td className="py-2.5 pr-3 text-ink">
                      {tx.description || "—"}
                      {tx.installment && (
                        <span className="ml-1.5 text-[11.5px] text-ink-3">{tx.installment}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-2">{tx.segment}</td>
                    <td className="py-2.5 pr-3">
                      <Pill tone={tx.bucket.startsWith("invest_") ? "brand" : "neutral"}>
                        {BUCKET_LABEL[tx.bucket]}
                      </Pill>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-2">{tx.card || tx.account || "—"}</td>
                    <td
                      className={`tnum py-2.5 pr-5 text-right font-medium ${
                        tx.flow === "in" ? "text-good" : "text-ink"
                      }`}
                    >
                      {tx.flow === "in" ? brlSigned(tx.amount) : brlSigned(-tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <p className="border-t border-hairline px-5 py-3 text-[11.5px] text-ink-3">
            Mostrando os {PAGE_SIZE} mais recentes de {filtered.length}. Use os filtros para
            estreitar.
          </p>
        )}
      </Card>

      {issues.length > 0 && (
        <Card className="mt-5">
          <CardHeader
            title="Linhas que o Pulse não conseguiu ler"
            hint="Ficaram de fora dos totais. Normalmente é data ou valor em branco."
          />
          <ul className="flex flex-col px-5 pb-4">
            {issues.slice(0, 12).map((issue, index) => (
              <li
                key={`${issue.row}-${index}`}
                className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-0"
              >
                <span className="tnum shrink-0 text-[11.5px] text-ink-3">linha {issue.row}</span>
                <span className="text-[12.5px] text-ink-2">{issue.reason}</span>
              </li>
            ))}
          </ul>
          {issues.length > 12 && (
            <p className="px-5 pb-4 text-[11.5px] text-ink-3">
              e mais {issues.length - 12} linha(s).
            </p>
          )}
        </Card>
      )}
    </PageShell>
  );
}

function matches(tx: Transaction, needle: string): boolean {
  const haystack = fold(
    [tx.description, tx.segment, tx.account, tx.card ?? "", tx.asset ?? "", tx.note ?? ""].join(" "),
  );
  return haystack.includes(needle);
}

function sum(transactions: Transaction[], bucket: Bucket): number {
  return transactions.reduce((total, tx) => (tx.bucket === bucket ? total + tx.amount : total), 0);
}
