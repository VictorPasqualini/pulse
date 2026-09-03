import type { Metadata } from "next";
import { loadDataset } from "@/lib/source";
import { investmentSummary } from "@/lib/metrics";
import { brl, brlSigned, pct, pctSigned } from "@/lib/money";
import { monthLabel, relativeFromNow } from "@/lib/dates";
import { flow, series as seriesColor } from "@/lib/palette";
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
  const previous = summary.series[summary.series.length - 2];
  const monthMove = previous ? last.position - previous.position : null;

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
              footnote="Ganho dividido pelo total aportado, sem ponderar tempo"
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
          <CardHeader title="Rendimento por mês" hint="Ganho e perda, já com sinal" />
          <DivergingColumns
            points={summary.series.map((point) => ({
              key: point.key,
              label: monthLabel(point.key),
              value: point.yield,
            }))}
            upLabel="Ganho"
            downLabel="Perda"
            valueLabel="Rendimento"
            height={220}
          />
        </Card>
      </div>

      {(summary.bestMonth || summary.worstMonth) && (
        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {summary.bestMonth && (
            <Card>
              <StatTile
                accent={flow.in}
                label="Melhor mês"
                value={brlSigned(summary.bestMonth.yield)}
                footnote={monthLabel(summary.bestMonth.key, "long")}
              />
            </Card>
          )}
          {summary.worstMonth && summary.worstMonth.key !== summary.bestMonth?.key && (
            <Card>
              <StatTile
                accent={flow.out}
                label="Pior mês"
                value={brlSigned(summary.worstMonth.yield)}
                footnote={monthLabel(summary.worstMonth.key, "long")}
              />
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader
          title="Por ativo"
          hint="Ordenado pela posição. Retorno é o rendimento sobre o que foi aportado no ativo."
        />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[11.5px] text-ink-3">
                <th className="py-2 pr-3 font-medium">Ativo</th>
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
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: seriesColor(asset.slot) }}
                      />
                      <span className="text-ink">{asset.asset}</span>
                    </span>
                  </td>
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
    </PageShell>
  );
}
