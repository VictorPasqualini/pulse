import Link from "next/link";
import { loadDataset } from "@/lib/source";
import {
  availableMonths,
  biggestExpenses,
  cardBuckets,
  inMonth,
  investmentSummary,
  monthlySeries,
  segmentSlices,
  trailingAverage,
  weeklySpend,
} from "@/lib/metrics";
import { brl, brlCompact, brlSigned, change, pct, pctSigned } from "@/lib/money";
import { dayLabel, monthLabel, relativeFromNow } from "@/lib/dates";
import { flow } from "@/lib/palette";
import { PageHeader, PageShell } from "@/components/chrome/PageHeader";
import { MonthPicker, SyncButton } from "@/components/chrome/Toolbar";
import { LoadError, Unconfigured } from "@/components/chrome/DataState";
import { Card, CardHeader, Delta, Divider, Empty, StatTile } from "@/components/ui/primitives";
import { FlowColumns } from "@/components/charts/FlowColumns";
import { DivergingColumns } from "@/components/charts/DivergingColumns";
import { SegmentBars } from "@/components/charts/SegmentBars";
import { WeekColumns } from "@/components/charts/WeekColumns";
import { Sparkline } from "@/components/charts/Sparkline";

export const dynamic = "force-dynamic";

const WINDOW = 12;

export default async function DashboardPage({
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
        <PageHeader title="Painel" />
        <LoadError message={result.message} hint={result.hint} />
      </PageShell>
    );
  }

  const { transactions, fetchedAt, sourceLabel, usedSheet } = result.dataset;
  const months = availableMonths(transactions);

  if (months.length === 0) {
    return (
      <PageShell>
        <PageHeader
          title="Painel"
          subtitle={`${sourceLabel}${usedSheet ? ` · aba ${usedSheet}` : ""}`}
          actions={<SyncButton fetchedLabel={`Lido ${relativeFromNow(fetchedAt)}`} />}
        />
        <Card>
          <Empty title="A planilha foi lida, mas nenhuma linha virou lançamento.">
            <p>
              Normalmente é o mapeamento das colunas: o Pulse precisa saber qual coluna é a data e
              qual é o valor. Confira em{" "}
              <Link className="text-brand underline" href="/configuracao">
                configuração
              </Link>
              .
            </p>
          </Empty>
        </Card>
      </PageShell>
    );
  }

  const current = mes && months.includes(mes) ? mes : months[0];
  const full = monthlySeries(transactions);
  const currentIndex = full.findIndex((month) => month.key === current);
  const shown = full.slice(Math.max(0, currentIndex - (WINDOW - 1)), currentIndex + 1);
  const totals = full[currentIndex];

  const avgIncome = trailingAverage(full, current, (m) => m.income);
  const avgExpense = trailingAverage(full, current, (m) => m.expense);

  const txMonth = inMonth(transactions, current);
  const expenseSlices = segmentSlices(txMonth, (tx) => tx.bucket === "expense");
  const incomeSlices = segmentSlices(txMonth, (tx) => tx.bucket === "income");
  const weeks = weeklySpend(transactions, current);
  const cards = cardBuckets(txMonth);
  const biggest = biggestExpenses(txMonth, 5);
  const investMonth = investmentSummary(txMonth);
  const investAll = investmentSummary(transactions);

  const incomeDelta = avgIncome != null ? change(totals.income, avgIncome) : null;
  const expenseDelta = avgExpense != null ? change(totals.expense, avgExpense) : null;
  const cardTotal = cards.reduce((sum, card) => sum + card.amount, 0);

  return (
    <PageShell>
      <PageHeader
        title="Painel"
        subtitle={`${sourceLabel}${usedSheet ? ` · aba ${usedSheet}` : ""}`}
        actions={<SyncButton fetchedLabel={`Lido ${relativeFromNow(fetchedAt)}`} />}
        filters={<MonthPicker months={months} current={current} />}
      />

      {/* Headline row. Saldo is the hero because it is the one number that answers
          "how did the month go"; the other three explain it. */}
      <Card className="mb-5">
        <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile
              hero
              label="Saldo do mês"
              value={brl(totals.net)}
              delta={
                totals.savingsRate != null ? (
                  <Delta value={pctSigned(totals.savingsRate, 0)} label="da entrada guardado" />
                ) : undefined
              }
              footnote={`${totals.count} lançamentos em ${monthLabel(current, "long")}`}
            />
          </div>
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile
              accent={flow.in}
              label="Entradas"
              value={brl(totals.income)}
              delta={
                incomeDelta != null ? (
                  <Delta value={pctSigned(incomeDelta, 0)} label="vs. média de 3 meses" />
                ) : undefined
              }
              footnote={avgIncome != null ? `Média: ${brlCompact(avgIncome)}` : undefined}
            />
          </div>
          <div className="border-hairline lg:border-r">
            <StatTile
              accent={flow.out}
              label="Saídas"
              value={brl(totals.expense)}
              delta={
                expenseDelta != null ? (
                  <Delta
                    value={pctSigned(expenseDelta, 0)}
                    label="vs. média de 3 meses"
                    goodWhen="down"
                  />
                ) : undefined
              }
              footnote={avgExpense != null ? `Média: ${brlCompact(avgExpense)}` : undefined}
            />
          </div>
          <div>
            <StatTile
              accent={flow.invest}
              label="Aportes no mês"
              value={brl(investMonth.contrib)}
              delta={
                investMonth.yield !== 0 ? (
                  <Delta value={brlSigned(investMonth.yield)} label="de rendimento" />
                ) : undefined
              }
              footnote="Fora do cálculo de gastos"
            />
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Entradas e saídas por mês"
            hint={`Últimos ${shown.length} meses. Aportes e rendimentos não entram aqui.`}
            aside={
              <div className="hidden sm:block">
                <Sparkline
                  values={shown.map((month) => month.net)}
                  color={flow.in}
                  label={`Saldo dos últimos ${shown.length} meses`}
                />
              </div>
            }
          />
          <FlowColumns series={shown} emphasis={current} />
        </Card>

        <Card>
          <CardHeader
            title="Gastos por segmento"
            hint={`${monthLabel(current, "long")} · clique para ver os lançamentos`}
          />
          <SegmentBars
            slices={expenseSlices}
            month={current}
            emptyLabel="Nenhuma saída neste mês."
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Gastos por semana"
            hint={`${monthLabel(current, "long")}, semanas começando na segunda-feira`}
          />
          <WeekColumns weeks={weeks} />
        </Card>

        <Card>
          <CardHeader title="Saldo por mês" hint="Entradas menos saídas, sem investimentos" />
          <DivergingColumns
            points={shown.map((month) => ({
              key: month.key,
              label: monthLabel(month.key),
              value: month.net,
              note:
                month.savingsRate != null
                  ? `${pct(month.savingsRate, 0)} da entrada`
                  : "Sem entradas no mês",
            }))}
            emphasis={current}
            upLabel="Sobrou"
            downLabel="Faltou"
            valueLabel="Saldo"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Cartão de crédito"
            hint={cardTotal > 0 ? `${brl(cardTotal)} no mês` : "Nenhuma despesa em cartão"}
            aside={
              <Link href="/cartoes" className="text-[12px] font-medium text-brand hover:underline">
                Ver tudo
              </Link>
            }
          />
          {cards.length === 0 ? (
            <Empty title="Nenhuma despesa marcada como cartão.">
              <p>
                O Pulse reconhece pela coluna de cartão ou por palavras como crédito e fatura no
                meio de pagamento.
              </p>
            </Empty>
          ) : (
            <ul className="flex flex-col px-5 pb-4">
              {cards.slice(0, 5).map((card) => (
                <li
                  key={card.card}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5 last:border-0"
                >
                  <span className="min-w-0 truncate text-[12.5px] text-ink">{card.card}</span>
                  <span className="tnum shrink-0 text-[12.5px] font-medium text-ink">
                    {brl(card.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Maiores saídas do mês" hint={monthLabel(current, "long")} />
          {biggest.length === 0 ? (
            <Empty title="Nenhuma saída neste mês." />
          ) : (
            <ul className="flex flex-col px-5 pb-4">
              {biggest.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-ink">
                      {tx.description || tx.segment}
                    </p>
                    <p className="text-[11.5px] text-ink-3">
                      {dayLabel(tx.date)} · {tx.segment}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[12.5px] font-medium text-ink">
                    {brl(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Investimentos"
            hint="Aporte é saída na planilha, mas não é gasto"
            aside={
              <Link
                href="/investimentos"
                className="text-[12px] font-medium text-brand hover:underline"
              >
                Abrir tela
              </Link>
            }
          />
          <div className="px-5 pb-4">
            <dl className="flex flex-col gap-2.5">
              <Row label="Posição acumulada" value={brl(investAll.position)} />
              <Row label="Total aportado" value={brl(investAll.contrib)} />
              <Row
                label="Rendimento acumulado"
                value={brlSigned(investAll.yield)}
                tone={investAll.yield >= 0 ? "text-good" : "text-bad"}
              />
              <Row
                label="Retorno sobre o aporte"
                value={
                  investAll.returnOnContrib != null ? pctSigned(investAll.returnOnContrib, 1) : "—"
                }
              />
            </dl>
          </div>
          <Divider />
          <p className="px-5 py-3 text-[11.5px] leading-snug text-ink-3">
            Rendimento entra como entrada na planilha e também fica fora do total de entradas do
            painel.
          </p>
        </Card>
      </div>

      {incomeSlices.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Entradas por segmento" hint={monthLabel(current, "long")} />
          <SegmentBars slices={incomeSlices} month={current} tone={flow.in} />
        </Card>
      )}
    </PageShell>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className={`tnum text-[13px] font-medium ${tone ?? "text-ink"}`}>{value}</dd>
    </div>
  );
}
