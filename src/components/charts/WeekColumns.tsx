"use client";

import { flow } from "@/lib/palette";
import { brl, brlCompact } from "@/lib/money";
import type { WeekBucket } from "@/lib/metrics";
import {
  Grid,
  HitArea,
  TooltipHost,
  YAxisLabels,
  barPath,
  barWidth,
  niceTicks,
  useMeasure,
  useTooltip,
} from "./chartkit";

/**
 * Spending by week of the selected month. One series, so no legend — the card
 * title names it. The reference line is the month's own weekly average, which is
 * what makes a tall week mean something.
 */

const PAD = { top: 20, right: 6, bottom: 30, left: 44 };
const HEIGHT = 200;

export function WeekColumns({ weeks }: { weeks: WeekBucket[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();

  return (
    <TooltipHost>
      <div ref={ref} className="px-5 pb-4">
        {width > 0 ? <Plot weeks={weeks} width={width} /> : <div style={{ height: HEIGHT }} />}
      </div>
    </TooltipHost>
  );
}

function Plot({ weeks, width }: { weeks: WeekBucket[]; width: number }) {
  const tooltip = useTooltip();
  const plotWidth = Math.max(80, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const spent = weeks.filter((week) => week.amount > 0);
  const average = spent.length ? spent.reduce((sum, w) => sum + w.amount, 0) / spent.length : 0;

  const ticks = niceTicks(Math.max(1, ...weeks.map((w) => w.amount), average));
  const top = ticks[ticks.length - 1] || 1;
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;

  const band = plotWidth / Math.max(1, weeks.length);
  const bar = barWidth(band);
  const peak = weeks.reduce((best, week) => (week.amount > best.amount ? week : best), weeks[0]);

  return (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label="Gastos por semana do mês"
      className="block overflow-visible"
    >
      <Grid ticks={ticks} scale={y} width={width - PAD.right} left={PAD.left} />
      <YAxisLabels ticks={ticks} scale={y} left={PAD.left} />

      {weeks.map((week, index) => {
        const center = PAD.left + band * index + band / 2;
        const isPeak = peak && week.week === peak.week && week.amount > 0;

        return (
          <g key={week.week}>
            <path
              d={barPath(center - bar / 2, y(week.amount), bar, y(0) - y(week.amount))}
              fill={flow.out}
              opacity={week.amount > 0 ? 1 : 0.35}
            />
            {isPeak && (
              <text
                x={center}
                y={y(week.amount) - 7}
                textAnchor="middle"
                className="tnum"
                fontSize={11}
                fontWeight={600}
                fill="var(--ink)"
              >
                {brlCompact(week.amount)}
              </text>
            )}
            <HitArea
              x={PAD.left + band * index}
              y={PAD.top}
              width={band}
              height={plotHeight}
              label={`Semana ${week.week}, dias ${week.label}: ${brl(week.amount)}`}
              onEnter={() =>
                tooltip.show({
                  x: center,
                  y: y(week.amount),
                  title: `Semana ${week.week} · ${week.label}`,
                  rows: [
                    { label: "Gasto", value: brl(week.amount), color: flow.out },
                    {
                      label: "Lançamentos",
                      value: String(week.count),
                      muted: true,
                    },
                  ],
                  note:
                    average > 0
                      ? `Média semanal do mês: ${brlCompact(average)}`
                      : undefined,
                })
              }
              onLeave={tooltip.hide}
            />
          </g>
        );
      })}

      {average > 0 && (
        <g>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(average)}
            y2={y(average)}
            stroke="var(--ink-3)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text
            x={width - PAD.right}
            y={y(average) - 5}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--ink-3)"
          >
            média
          </text>
        </g>
      )}

      <line
        x1={PAD.left}
        x2={width - PAD.right}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--axis)"
        strokeWidth={1}
        shapeRendering="crispEdges"
      />

      <g aria-hidden>
        {weeks.map((week, index) => (
          <text
            key={week.week}
            x={PAD.left + band * index + band / 2}
            y={HEIGHT - 12}
            textAnchor="middle"
            fontSize={10.5}
            fill="var(--ink-2)"
          >
            {week.label}
          </text>
        ))}
      </g>
    </svg>
  );
}
