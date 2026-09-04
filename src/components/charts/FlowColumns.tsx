"use client";

import { flow } from "@/lib/palette";
import { brl, brlCompact } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import type { MonthTotals } from "@/lib/metrics";
import {
  Grid,
  HitArea,
  Legend,
  TooltipHost,
  XAxisLabels,
  YAxisLabels,
  barPath,
  barWidth,
  niceTicks,
  useMeasure,
  useTooltip,
} from "./chartkit";

/**
 * Entradas vs. saídas, month by month. Two series on one money axis — grouped,
 * not stacked, because the comparison is between them, not their sum. Investment
 * movements are absent by construction: only the income and expense buckets reach
 * MonthTotals.income / .expense.
 */

const PAD = { top: 14, right: 6, bottom: 24, left: 44 };
const HEIGHT = 236;

export function FlowColumns({ series, emphasis }: { series: MonthTotals[]; emphasis?: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();

  return (
    <TooltipHost>
      <div ref={ref} className="px-5 pb-4">
        {width > 0 && <Plot series={series} emphasis={emphasis} width={width} />}
        {width === 0 && <div style={{ height: HEIGHT }} />}
        <Legend
          className="mt-3 pl-[44px]"
          items={[
            { label: "Entradas", color: flow.in },
            { label: "Saídas", color: flow.out },
          ]}
        />
      </div>
    </TooltipHost>
  );
}

function Plot({
  series,
  emphasis,
  width,
}: {
  series: MonthTotals[];
  emphasis?: string;
  width: number;
}) {
  const tooltip = useTooltip();
  const plotWidth = Math.max(80, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const peak = Math.max(1, ...series.map((m) => Math.max(m.income, m.expense)));
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1] || 1;
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;

  const band = plotWidth / Math.max(1, series.length);
  const bar = barWidth(band, 2);
  const groupWidth = bar * 2 + 2;

  /** Every third month, plus the emphasised one — twelve labels never fit. */
  const stride = Math.max(1, Math.ceil(series.length / (plotWidth > 620 ? 12 : 6)));

  return (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label="Entradas e saídas por mês"
      className="block"
    >
      <Grid ticks={ticks} scale={y} width={width - PAD.right} left={PAD.left} />
      <YAxisLabels ticks={ticks} scale={y} left={PAD.left} />

      {series.map((month, index) => {
        const center = PAD.left + band * index + band / 2;
        const left = center - groupWidth / 2;
        const isEmphasis = month.key === emphasis;

        return (
          <g key={month.key}>
            {isEmphasis && (
              <rect
                x={PAD.left + band * index}
                y={PAD.top}
                width={band}
                height={plotHeight}
                fill="var(--surface-3)"
                opacity={0.55}
                aria-hidden
              />
            )}
            <path d={barPath(left, y(month.income), bar, y(0) - y(month.income))} fill={flow.in} />
            <path
              d={barPath(left + bar + 2, y(month.expense), bar, y(0) - y(month.expense))}
              fill={flow.out}
            />
            <HitArea
              x={PAD.left + band * index}
              y={PAD.top}
              width={band}
              height={plotHeight}
              label={`${monthLabel(month.key, "long")}: entradas ${brl(month.income)}, saídas ${brl(month.expense)}`}
              onEnter={() =>
                tooltip.show({
                  x: center,
                  y: Math.min(y(month.income), y(month.expense)),
                  title: monthLabel(month.key, "long"),
                  rows: [
                    { label: "Entradas", value: brl(month.income), color: flow.in },
                    { label: "Saídas", value: brl(month.expense), color: flow.out },
                    { label: "Saldo", value: brl(month.net), muted: true },
                  ],
                  note:
                    month.contrib > 0 || month.yield !== 0
                      ? `Investimentos no mês: ${brlCompact(month.contrib)} aportados`
                      : undefined,
                })
              }
              onLeave={tooltip.hide}
            />
          </g>
        );
      })}

      <line
        x1={PAD.left}
        x2={width - PAD.right}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--axis)"
        strokeWidth={1}
        shapeRendering="crispEdges"
      />

      <XAxisLabels
        y={HEIGHT - 6}
        emphasis={emphasis}
        items={series
          .map((month, index) => ({ month, index }))
          .filter(({ month, index }) => index % stride === 0 || month.key === emphasis)
          .map(({ month, index }) => ({
            key: month.key,
            label: monthLabel(month.key),
            x: PAD.left + band * index + band / 2,
          }))}
      />
    </svg>
  );
}
