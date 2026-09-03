import type { Metadata } from "next";
import { loadDataset } from "@/lib/source";
import { availableMonths, cardBuckets, inMonth, segmentSlices } from "@/lib/metrics";
import type { Slice } from "@/lib/metrics";
import type { Transaction } from "@/lib/types";
import { brl, pct } from "@/lib/money";
import { dayLabel, monthKey, monthLabel, relativeFromNow } from "@/lib/dates";
import { flow } from "@/lib/palette";
import { PageHeader, PageShell } from "@/components/chrome/PageHeader";
import { MonthPicker, SyncButton } from "@/components/chrome/Toolbar";
import { LoadError, Unconfigured } from "@/components/chrome/DataState";
import { Card, CardHeader, Empty, StatTile } from "@/components/ui/primitives";
import { SegmentBars } from "@/components/charts/SegmentBars";
import { TrendArea } from "@/components/charts/TrendArea";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cartões",
  description: "Quanto do mês passou pelo cartão de crédito, por cartão e por segmento.",
};

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const [{ mes }, result] = await Promise.all([searchParams, loadDataset()]);

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
        <PageHeader title="Cartões" />
        <LoadError message={result.message} hint={result.hint} />
      </PageShell>
    );
  }

  const { transactions, fetchedAt } = result.dataset;
  const months = availableMonths(transactions);
  const current = mes && months.includes(mes) ? mes : (months[0] ?? "");

  const txMonth = current ? inMonth(transactions, current) : [];
  const cards = cardBuckets(txMonth);
  const total = cards.reduce((sum, card) => sum + card.amount, 0);
  const monthExpense = txMonth
    .filter((tx) => tx.bucket === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const share = monthExpense > 0 ? total / monthExpense : null;
  const rows = txMonth
    .filter((tx) => tx.bucket === "expense" && tx.card)
    .sort((a, b) => b.amount - a.amount);

  /** Card buckets reuse the segment-bar row, which only needs name/amount/share. */
  const cardSlices: Slice[] = cards.map((card) => ({
    name: card.card,
    amount: card.amount,
    share: total > 0 ? card.amount / total : 0,
    count: card.count,
    slot: card.slot,
  }));

  const bySegment = segmentSlices(
    txMonth.filter((tx) => Boolean(tx.card)),
    (tx) => tx.bucket === "expense",
  );

  const monthlyCard = monthlyCardSpend(transactions);

  const header = (
    <PageHeader
      title="Cartões"
      subtitle="Despesas que a planilha marca como crédito, agrupadas por cartão."
      actions={<SyncButton fetchedLabel={`Lido ${relativeFromNow(fetchedAt)}`} />}
      filters={months.length > 0 ? <MonthPicker months={months} current={current} /> : undefined}
    />
  );

  if (cards.length === 0) {
    return (
      <PageShell>
        {header}
        <Card>
          <Empty title="Nenhuma despesa de cartão neste mês.">
            <p>
              O Pulse marca uma despesa como cartão quando existe uma coluna de cartão preenchida,
              ou quando o meio de pagamento fala em crédito, cartão ou fatura. Se sua planilha usa
              outra palavra, acrescente ela na configuração.
            </p>
          </Empty>
        </Card>
      </PageShell>
    );
  }

  const biggest = cards[0];

  return (
    <PageShell>
      {header}

      <Card className="mb-5">
        <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile
              hero
              label="Total no cartão"
              value={brl(total)}
              footnote={`${monthLabel(current, "long")} · ${rows.length} lançamentos`}
            />
          </div>
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile
              accent={flow.out}
              label="Parcela das saídas"
              value={share != null ? pct(share, 0) : "—"}
              footnote={monthExpense > 0 ? `Saídas do mês: ${brl(monthExpense)}` : undefined}
            />
          </div>
          <div className="border-hairline lg:border-r">
            <StatTile label="Maior cartão" value={biggest.card} footnote={brl(biggest.amount)} />
          </div>
          <div>
            <StatTile
              label="Ticket médio"
              value={rows.length > 0 ? brl(total / rows.length) : "—"}
              footnote="Valor médio por lançamento no cartão"
            />
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Por cartão" hint={monthLabel(current, "long")} />
          <SegmentBars slices={cardSlices} month={current} />
        </Card>

        <Card>
          <CardHeader title="Por segmento, só cartão" hint={monthLabel(current, "long")} />
          <SegmentBars slices={bySegment} month={current} />
        </Card>
      </div>

      {monthlyCard.length > 1 && (
        <Card className="mb-5">
          <CardHeader title="Fatura por mês" hint="Total lançado em cartão em cada mês" />
          <TrendArea
            title="Gasto em cartão por mês"
            valueLabel="Cartão"
            color={flow.out}
            points={monthlyCard.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              value: point.amount,
            }))}
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Lançamentos no cartão"
          hint={`${monthLabel(current, "long")} · maiores primeiro`}
        />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[11.5px] text-ink-3">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Descrição</th>
                <th className="py-2 pr-3 font-medium">Cartão</th>
                <th className="py-2 pr-3 font-medium">Segmento</th>
                <th className="py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((tx) => (
                <tr key={tx.id} className="border-b border-hairline last:border-0">
                  <td className="tnum py-2.5 pr-3 whitespace-nowrap text-ink-3">
                    {dayLabel(tx.date)}
                  </td>
                  <td className="py-2.5 pr-3 text-ink">
                    {tx.description || "—"}
                    {tx.installment && (
                      <span className="ml-1.5 text-[11.5px] text-ink-3">{tx.installment}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-ink-2">{tx.card}</td>
                  <td className="py-2.5 pr-3 text-ink-2">{tx.segment}</td>
                  <td className="tnum py-2.5 text-right font-medium text-ink">{brl(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 40 && (
            <p className="pt-3 text-[11.5px] text-ink-3">
              Mostrando os 40 maiores de {rows.length} lançamentos.
            </p>
          )}
        </div>
      </Card>
    </PageShell>
  );
}

/** Last twelve months of credit-card spend, for the trend line. */
function monthlyCardSpend(transactions: Transaction[]): { key: string; amount: number }[] {
  const byMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.bucket !== "expense" || !tx.card) continue;
    const key = monthKey(tx.date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + tx.amount);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, amount]) => ({ key, amount }));
}
