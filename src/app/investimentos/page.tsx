import type { Metadata } from "next";
import { loadDataset } from "@/lib/source";
import { investmentSummary } from "@/lib/metrics";
import { brl, brlSigned, pct, pctSigned } from "@/lib/money";
import { monthLabel, relativeFromNow } from "@/lib/dates";
import { flow } from "@/lib/palette";
import { PageHeader, PageShell } from "@/components/chrome/PageHeader";
import { SyncButton } from "@/components/chrome/Toolbar";
import { LoadError, Unconfigured } from "@/components/chrome/DataState";
import { Card, CardHeader, Delta, Empty, StatTile } from "@/components/ui/primitives";
import { TrendArea } from "@/components/charts/TrendArea";
import { DivergingColumns } from "@/components/charts/DivergingColumns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investimentos",
  description: "Aportes, resgates e rendimento acumulado, separados do fluxo de caixa.",
};

export default async function InvestmentsPage() {
  const result = await loadDataset();

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
        <PageHeader title="Investimentos" />
        <LoadError message={result.message} hint={result.hint} />
      </PageShell>
    );
  }

  const { transactions, fetchedAt } = result.dataset;
  const summary = investmentSummary(transactions);

  const header = (
    <PageHeader
      title="Investimentos"
      subtitle="Aporte sai da conta mas não é gasto; rendimento entra mas não é receita. Aqui eles são o assunto."
      actions={<SyncButton fetchedLabel={`Lido ${relativeFromNow(fetchedAt)}`} />}
    />
  );

  if (summary.series.length === 0) {
    return (
      <PageShell>
        {header}
        <Card>
          <Empty title="Nenhum investimento reconhecido na planilha.">
            <p>
              O Pulse identifica investimento por uma coluna de ativo ou por termos como tesouro,
              CDB, FII, ações, cripto, aporte e rendimento. Dá para ajustar essa lista de termos na
              configuração, sem mexer na planilha.
            </p>
          </Empty>
        </Card>
      </PageShell>
    );
  }

  const last = summary.series[summary.series.length - 1];
  const monthMove = summary.series.length > 1 ? last.growth : null;

  // Part of the yield is inferred rather than written down, and a screen that shows
  // an inferred number without saying so is lying quietly.
  const hasEstimate = summary.series.some((point) => Math.abs(point.estimated) > 0.005);
  const estimateNote = hasEstimate
    ? "Inclui rendimento estimado: o ganho de um resgate é rateado pelos meses aplicados."
    : undefined;

  return (
    <PageShell>
      {header}

      <Card className="mb-5">
        <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile
              hero
              label="Posição acumulada"
              value={brl(summary.position)}
              delta={
                monthMove != null ? (
                  <Delta value={brlSigned(monthMove)} label={`em ${monthLabel(last.key, "long")}`} />
                ) : undefined
              }
              footnote="Aportes − resgates + rendimento, conforme a planilha"
            />
          </div>
          <div className="border-hairline sm:border-b lg:border-b-0 lg:border-r">
            <StatTile accent={flow.invest} label="Total aportado" value={brl(summary.contrib)} />
          </div>
          <div className="border-hairline lg:border-r">
            <StatTile
              accent={summary.yield >= 0 ? flow.in : flow.out}
              label="Rendimento acumulado"
              value={brlSigned(summary.yield)}
              footnote={summary.withdraw > 0 ? `Resgatado: ${brl(summary.withdraw)}` : undefined}
            />
          </div>
          <div>
            <StatTile
              label="Retorno sobre o aporte"
              value={summary.returnOnContrib != null ? pctSigned(summary.returnOnContrib, 1) : "—"}
              footnote="Ganho sobre o aportado, sem ponderar tempo. Resgate maior que o aporte do ativo entra como ganho."
            />
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Patrimônio acumulado"
            hint="Posição ao fim de cada mês, somando aportes e rendimento"
          />
          <TrendArea
            title="Patrimônio acumulado por mês"
            valueLabel="Posição"
            color={flow.invest}
            points={summary.series.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              value: point.position,
              rows: [
                { label: "Posição", value: brl(point.position), color: flow.invest },
                { label: "Aportes no mês", value: brl(point.contrib), muted: true },
                { label: "Rendimento", value: brlSigned(point.yield), muted: true },
              ],
            }))}
          />
        </Card>

        <Card>
          <CardHeader
            title="Crescimento no mês"
            hint="Quanto a posição subiu ou caiu, e de onde veio"
          />
          <DivergingColumns
            points={summary.series.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              value: point.growth,
              rows: [
                {
                  label: "Crescimento",
                  value: brlSigned(point.growth),
                  color: point.growth >= 0 ? flow.in : flow.out,
                },
                { label: "Aportes", value: brl(point.contrib), muted: true },
                ...(point.withdraw > 0
                  ? [{ label: "Resgates", value: `−${brl(point.withdraw)}`, muted: true }]
                  : []),
                { label: "Rendimento", value: brlSigned(point.yield), muted: true },
                ...(point.growthRate != null
                  ? [{ label: "Variação", value: pctSigned(point.growthRate, 1), muted: true }]
                  : []),
                { label: "Posição no fim", value: brl(point.position), muted: true },
              ],
              // A month can fall without losing a cent: a resgate moves money out of
              // the portfolio, and the bar has to say which of the two happened.
              note:
                point.growth < 0 && point.withdraw > 0
                  ? "Queda por resgate, não por perda."
                  : undefined,
            }))}
            upLabel="Cresceu"
            downLabel="Caiu"
            valueLabel="Crescimento"
            height={220}
          />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Rendimento por mês"
            hint={
              hasEstimate
                ? "Ganho e perda, com o ganho do resgate rateado pelos meses aplicados"
                : "Ganho e perda, já com sinal"
            }
          />
          <DivergingColumns
            points={summary.series.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              value: point.yield,
              rows: [
                {
                  label: "Rendimento",
                  value: brlSigned(point.yield),
                  color: point.yield >= 0 ? flow.in : flow.out,
                },
                ...(Math.abs(point.estimated) > 0.005
                  ? [{ label: "Estimado no rateio", value: brlSigned(point.estimated), muted: true }]
                  : []),
              ],
              note:
                Math.abs(point.estimated) > 0.005
                  ? "Parte vem de resgate sem rendimento declarado."
                  : undefined,
            }))}
            upLabel="Ganho"
            downLabel="Perda"
            valueLabel="Rendimento"
            height={220}
          />
          {estimateNote && (
            <p className="px-5 pb-5 text-[11.5px] leading-snug text-ink-3">{estimateNote}</p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Rentabilidade ao mês"
            hint="Rendimento sobre o capital médio aplicado no mês"
          />
          <DivergingColumns
            points={summary.series.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              // A month with nothing invested has no rate; it draws flat rather than
              // disappearing, so the timeline keeps its shape.
              value: point.rate ?? 0,
              rows:
                point.rate != null
                  ? [
                      {
                        label: "Rentabilidade",
                        value: pctSigned(point.rate, 2),
                        color: point.rate >= 0 ? flow.in : flow.out,
                      },
                      { label: "Rendimento", value: brlSigned(point.yield), muted: true },
                      { label: "Capital médio", value: brl(point.capital), muted: true },
                    ]
                  : [{ label: "Rentabilidade", value: "—" }],
              note:
                point.rate == null
                  ? "Nada aplicado neste mês."
                  : Math.abs(point.estimated) > 0.005
                    ? "Parte vem de resgate sem rendimento declarado."
                    : undefined,
            }))}
            upLabel="Ganho"
            downLabel="Perda"
            valueLabel="Rentabilidade"
            height={220}
            format="percent"
            reference={
              summary.avgMonthlyRate != null
                ? { value: summary.avgMonthlyRate, label: "Média" }
                : undefined
            }
          />
          <p className="px-5 pb-5 text-[11.5px] leading-snug text-ink-3">
            {summary.avgMonthlyYield != null
              ? `Média de ${summary.monthsCounted} ${
                  summary.monthsCounted === 1 ? "mês" : "meses"
                }: ${brlSigned(summary.avgMonthlyYield)} por mês.`
              : ""}{" "}
            O capital médio pondera pelos dias, então um aporte grande no fim do mês não
            derruba a taxa.
          </p>
        </Card>
      </div>

      {summary.assets.length > 1 && (
        <Card>
          <CardHeader
            title="Por ativo"
            hint={
              summary.groupedBy === "asset"
                ? "Ordenado pelo tamanho do ativo. Retorno é o rendimento sobre o que foi aportado nele."
                : "Sem coluna de ativo na planilha, cada linha vem da descrição, ordenada pelo tamanho."
            }
          />
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[11.5px] text-ink-3">
                  <th className="py-2 pr-3 font-medium">
                    {summary.groupedBy === "asset" ? "Ativo" : "Descrição"}
                  </th>
                  <th className="py-2 pr-3 text-right font-medium">Aportado</th>
                  <th className="py-2 pr-3 text-right font-medium">Resgatado</th>
                  <th className="py-2 pr-3 text-right font-medium">Rendimento</th>
                  <th className="py-2 pr-3 text-right font-medium">Retorno</th>
                  <th className="py-2 text-right font-medium">Posição</th>
                </tr>
              </thead>
              <tbody>
                {summary.assets.map((asset) => (
                  <tr key={asset.asset} className="border-b border-hairline last:border-0">
                    {/* No swatch: nothing in this table is colour-coded, and a hue keyed
                        to the row's rank would repaint every asset whenever the order
                        changed. The name is the identity. */}
                    <td className="py-2.5 pr-3 text-ink">{asset.asset}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">{brl(asset.contrib)}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">
                      {asset.withdraw > 0 ? brl(asset.withdraw) : "—"}
                    </td>
                    <td
                      className={`tnum py-2.5 pr-3 text-right font-medium ${
                        asset.yield >= 0 ? "text-good" : "text-bad"
                      }`}
                    >
                      {asset.yield !== 0 ? brlSigned(asset.yield) : "—"}
                    </td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">
                      {asset.returnOnContrib != null ? pct(asset.returnOnContrib, 1) : "—"}
                    </td>
                    <td className="tnum py-2.5 text-right font-medium text-ink">
                      {brl(asset.position)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
