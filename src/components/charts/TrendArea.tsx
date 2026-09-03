"use client";

import { useRef, useState } from "react";
import { brl } from "@/lib/money";
import {
  Crosshair,
  Grid,
  LINE_WIDTH,
  Marker,
  TooltipHost,
  XAxisLabels,
  YAxisLabels,
  niceTicks,
  useMeasure,
  useTooltip,
  type TooltipRow,
} from "./chartkit";

/**
 * A single measure over time: patrimônio acumulado, saldo acumulado. Line plus a
 * faint wash under it — the wash reads "amount", the line reads "when". One axis,
 * one series; a second measure of a different scale gets its own chart.
 */

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
  rows?: TooltipRow[];
}

const PAD = { top: 18, right: 14, bottom: 24, left: 44 };

export function TrendArea({
  points,
  color,
  height = 220,
  title,
  valueLabel = "Valor",
}: {
  points: TrendPoint[];
  /** A `var(--…)` reference from the palette, never a literal hex. */
  color: string;
  height?: number;
  title: string;
  valueLabel?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();

  return (
    <TooltipHost>
      <div ref={ref} className="px-5 pb-4">
        {width > 0 ? (
          <Plot
            points={points}
            color={color}
            width={width}
            height={height}
            title={title}
            valueLabel={valueLabel}
          />
        ) : (
          <div style={{ height }} />
        )}
      </div>
    </TooltipHost>
  );
}

function Plot({
  points,
  color,
  width,
  height,
  title,
  valueLabel,
}: {
  points: TrendPoint[];
  color: string;
  width: number;
  height: number;
  title: string;
  valueLabel: string;
}) {
  const tooltip = useTooltip();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const plotWidth = Math.max(80, width - PAD.left - PAD.right);
  const plotHeight = height - PAD.top - PAD.bottom;

  const ticks = niceTicks(Math.max(1, ...points.map((p) => p.value)));
  const top = ticks[ticks.length - 1] || 1;
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const x = (index: number) =>
    points.length === 1
      ? PAD.left + plotWidth / 2
      : PAD.left + (index / (points.length - 1)) * plotWidth;

  const line = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(point.value)}`).join(" ");
  const wash = `${line} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;

  const last = points.length - 1;
  const stride = Math.max(1, Math.ceil(points.length / (plotWidth > 620 ? 12 : 6)));

  const pick = (event: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width > 0 ? width / rect.width : 1;
    const local = (event.clientX - rect.left) * scale;
    const ratio = (local - PAD.left) / plotWidth;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * Math.max(1, points.length - 1))),
    );
    const point = points[index];
    setActive(index);
    tooltip.show({
      x: x(index),
      y: y(point.value),
      title: point.label,
      rows: point.rows ?? [{ label: valueLabel, value: brl(point.value), color }],
    });
  };

  const clear = () => {
    setActive(null);
    tooltip.hide();
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      className="block overflow-visible"
    >
      <Grid ticks={ticks} scale={y} width={width - PAD.right} left={PAD.left} />
      <YAxisLabels ticks={ticks} scale={y} left={PAD.left} />

      <path d={wash} fill={color} opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {active !== null && (
        <>
          <Crosshair x={x(active)} top={PAD.top} bottom={PAD.top + plotHeight} />
          <Marker x={x(active)} y={y(points[active].value)} color={color} />
        </>
      )}

      {active === null && points.length > 0 && (
        <>
          <Marker x={x(last)} y={y(points[last].value)} color={color} />
          <text
            x={x(last)}
            y={y(points[last].value) - 12}
            textAnchor="end"
            className="tnum"
            fontSize={11}
            fontWeight={600}
            fill="var(--ink)"
          >
            {brl(points[last].value)}
          </text>
        </>
      )}

      <rect
        x={PAD.left}
        y={PAD.top}
        width={plotWidth}
        height={plotHeight}
        fill="transparent"
        onMouseMove={pick}
        onMouseLeave={clear}
      />

      <XAxisLabels
        y={height - 6}
        items={points
          .map((point, index) => ({ point, index }))
          .filter(({ index }) => index % stride === 0 || index === last)
          .map(({ point, index }) => ({ key: point.key, label: point.label, x: x(index) }))}
      />
    </svg>
  );
}
