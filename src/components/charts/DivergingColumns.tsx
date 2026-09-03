"use client";

import { flow } from "@/lib/palette";
import { brl, brlSigned } from "@/lib/money";
import {
  Grid,
  HitArea,
  Legend,
  TooltipHost,
  XAxisLabels,
  YAxisLabels,
  barPath,
  barWidth,
  divergingTicks,
  useMeasure,
  useTooltip,
} from "./chartkit";

/**
 * A signed quantity around zero — monthly saldo, monthly rendimento. Diverging
 * encoding: one hue up, one hue down, a neutral zero rule between them. The axis
 * is symmetric so a −2.000 reads as far from zero as a +2.000.
 */

export interface DivergingPoint {
  key: string;
  label: string;
  value: number;
  note?: string;
}

const PAD = { top: 16, right: 6, bottom: 24, left: 44 };

export function DivergingColumns({
  points,
  emphasis,
  upLabel,
  downLabel,
  height = 180,
  valueLabel = "Valor",
}: {
  points: DivergingPoint[];
  emphasis?: string;
  upLabel: string;
  downLabel: string;
  height?: number;
  valueLabel?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();

  return (
    <TooltipHost>
      <div ref={ref} className="px-5 pb-4">
        {width > 0 ? (
          <Plot
            points={points}
            emphasis={emphasis}
            width={width}
            height={height}
            valueLabel={valueLabel}
          />
        ) : (
          <div style={{ height }} />
        )}
        <Legend
          className="mt-3 pl-[44px]"
          items={[
            { label: upLabel, color: flow.in },
            { label: downLabel, color: flow.out },
          ]}
        />
      </div>
    </TooltipHost>
  );
}

function Plot({
  points,
  emphasis,
  width,
  height,
  valueLabel,
}: {
  points: DivergingPoint[];
  emphasis?: string;
  width: number;
  height: number;
  valueLabel: string;
}) {
  const tooltip = useTooltip();
  const plotWidth = Math.max(80, width - PAD.left - PAD.right);
  const plotHeight = height - PAD.top - PAD.bottom;

  const magnitude = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const ticks = divergingTicks(magnitude);
  const top = Math.max(...ticks) || 1;
  const y = (value: number) => PAD.top + plotHeight / 2 - (value / top) * (plotHeight / 2);
  const zero = y(0);

  const band = plotWidth / Math.max(1, points.length);
  const bar = barWidth(band);
  const stride = Math.max(1, Math.ceil(points.length / (plotWidth > 620 ? 12 : 6)));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={valueLabel}
      className="block overflow-visible"
    >
      <Grid ticks={ticks} scale={y} width={width - PAD.right} left={PAD.left} showZero />
      <YAxisLabels ticks={ticks} scale={y} left={PAD.left} />

      {points.map((point, index) => {
        const center = PAD.left + band * index + band / 2;
        const up = point.value >= 0;
        const size = Math.abs(zero - y(point.value));

        return (
          <g key={point.key}>
            {point.key === emphasis && (
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
            <path
              d={barPath(center - bar / 2, up ? y(point.value) : zero, bar, size, up)}
              fill={up ? flow.in : flow.out}
            />
            <HitArea
              x={PAD.left + band * index}
              y={PAD.top}
              width={band}
              height={plotHeight}
              label={`${point.label}: ${brlSigned(point.value)}`}
              onEnter={() =>
                tooltip.show({
                  x: center,
                  y: up ? y(point.value) : zero,
                  title: point.label,
                  rows: [{ label: valueLabel, value: brl(point.value), color: up ? flow.in : flow.out }],
                  note: point.note,
                })
              }
              onLeave={tooltip.hide}
            />
          </g>
        );
      })}

      <XAxisLabels
        y={height - 6}
        emphasis={emphasis}
        items={points
          .map((point, index) => ({ point, index }))
          .filter(({ point, index }) => index % stride === 0 || point.key === emphasis)
          .map(({ point, index }) => ({
            key: point.key,
            label: point.label,
            x: PAD.left + band * index + band / 2,
          }))}
      />
    </svg>
  );
}
