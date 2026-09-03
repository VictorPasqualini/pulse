"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { compact } from "@/lib/money";

/**
 * The pieces every chart in Pulse is built from.
 *
 * Fixed specs, applied everywhere so the charts read as one system:
 *   bars     ≤ 24px thick, 4px rounded data-end, square at the baseline
 *   lines    2px, round caps and joins
 *   markers  r ≥ 4 with a 2px ring in the surface colour
 *   grid     1px solid, one step off the surface, never dashed
 *   gaps     2px of surface between touching marks
 */

export const BAR_MAX = 24;
export const BAR_RADIUS = 4;
export const LINE_WIDTH = 2;
export const MARKER_RADIUS = 4.5;
export const SURFACE_GAP = 2;

/* ------------------------------------------------------------------ layout */

/** Container width, so bars get real pixel geometry and labels can be measured
 *  before they are placed. */
export function useMeasure<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => setWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/* ------------------------------------------------------------------- scale */

/** Axis ticks on round numbers — 0 / 2.000 / 4.000, never 0 / 1.873 / 3.746. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  return ticks;
}

/** Symmetric ticks for a diverging axis, so zero sits where it should. */
export function divergingTicks(magnitude: number, count = 2): number[] {
  const positive = niceTicks(magnitude, count).filter((t) => t > 0);
  return [...positive.map((t) => -t).reverse(), 0, ...positive];
}

/** Bar thickness inside a band: capped, and never filling the band. */
export function barWidth(band: number, seriesCount = 1): number {
  const usable = band * 0.62;
  const each = (usable - SURFACE_GAP * (seriesCount - 1)) / seriesCount;
  return Math.max(3, Math.min(BAR_MAX, each));
}

/**
 * A rectangle with its data-end rounded and its baseline square, drawn as a path
 * so the two ends can differ. `up` false flips it for bars below a zero line.
 */
export function barPath(x: number, y: number, w: number, h: number, up = true): string {
  const r = Math.min(BAR_RADIUS, w / 2, Math.abs(h));
  if (h <= 0.5) return `M${x} ${y}h${w}`;
  return up
    ? `M${x} ${y + h}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h}Z`
    : `M${x} ${y}V${y + h - r}a${r} ${r} 0 0 0 ${r} ${r}h${w - 2 * r}a${r} ${r} 0 0 0 ${r} ${-r}V${y}Z`;
}

/* -------------------------------------------------------------------- grid */

export function Grid({
  ticks,
  scale,
  width,
  left,
  showZero = false,
}: {
  ticks: number[];
  scale: (value: number) => number;
  width: number;
  left: number;
  showZero?: boolean;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <line
          key={tick}
          x1={left}
          x2={width}
          y1={scale(tick)}
          y2={scale(tick)}
          stroke={tick === 0 && showZero ? "var(--axis)" : "var(--grid)"}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      ))}
    </g>
  );
}

/**
 * Tick labels drop the currency prefix: "R$ 12,4 mil" is 60-odd pixels of gutter
 * for a number nobody reads precisely off an axis. The card title says what the
 * axis measures and every tooltip spells the amount out in full.
 */
export function YAxisLabels({
  ticks,
  scale,
  left,
  format = compact,
}: {
  ticks: number[];
  scale: (value: number) => number;
  left: number;
  format?: (value: number) => string;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <text
          key={tick}
          x={left - 8}
          y={scale(tick)}
          textAnchor="end"
          dominantBaseline="middle"
          className="tnum"
          fontSize={10.5}
          fill="var(--ink-3)"
        >
          {format(tick)}
        </text>
      ))}
    </g>
  );
}

export function XAxisLabels({
  items,
  y,
  emphasis,
}: {
  items: { key: string; label: string; x: number }[];
  y: number;
  emphasis?: string;
}) {
  return (
    <g aria-hidden>
      {items.map((item) => (
        <text
          key={item.key}
          x={item.x}
          y={y}
          textAnchor="middle"
          fontSize={10.5}
          fill={item.key === emphasis ? "var(--ink)" : "var(--ink-3)"}
          fontWeight={item.key === emphasis ? 600 : 400}
        >
          {item.label}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ legend */

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

/** Always present for two or more series — identity never rests on colour alone. */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className ?? ""}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: item.color }}
          />
          <span>{item.label}</span>
          {item.value && <span className="tnum text-ink-3">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- tooltip */

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  muted?: boolean;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
  note?: string;
}

const TooltipContext = createContext<{
  show: (state: TooltipState) => void;
  hide: () => void;
} | null>(null);

/**
 * Hover layer. An HTML chart is interactive by default, so every chart here ships
 * a tooltip; the only figure without one is a bare stat tile. The panel is HTML
 * rather than SVG so it can wrap, use the app's type, and never be clipped by the
 * chart's own viewBox.
 */
export function TooltipHost({ children, className }: { children: ReactNode; className?: string }) {
  const [state, setState] = useState<TooltipState | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback((next: TooltipState) => setState(next), []);
  const hide = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, hide]);

  const hostWidth = hostRef.current?.clientWidth ?? 0;
  const PANEL = 208;
  const flip = state ? state.x + PANEL + 16 > hostWidth : false;

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      <div ref={hostRef} className={`relative ${className ?? ""}`}>
        {children}
        {state && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-20 w-52 rounded-lg border border-hairline-strong bg-surface-2 p-2.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.55)]"
            style={{
              left: flip ? undefined : state.x + 12,
              right: flip ? Math.max(8, hostWidth - state.x + 12) : undefined,
              top: Math.max(4, state.y - 12),
            }}
          >
            <p className="mb-1.5 text-[11.5px] font-semibold text-ink">{state.title}</p>
            <dl className="flex flex-col gap-1">
              {state.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <dt className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-2">
                    {row.color && (
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: row.color }}
                      />
                    )}
                    <span className="truncate">{row.label}</span>
                  </dt>
                  <dd
                    className={`tnum shrink-0 text-[11.5px] font-medium ${row.muted ? "text-ink-3" : "text-ink"}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            {state.note && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{state.note}</p>}
          </div>
        )}
      </div>
    </TooltipContext.Provider>
  );
}

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) throw new Error("useTooltip precisa estar dentro de <TooltipHost>.");
  return context;
}

/** Vertical crosshair for line and area charts. */
export function Crosshair({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return (
    <line
      x1={x}
      x2={x}
      y1={top}
      y2={bottom}
      stroke="var(--hairline-strong)"
      strokeWidth={1}
      shapeRendering="crispEdges"
      aria-hidden
    />
  );
}

/** A dot with the 2px surface ring that keeps it legible over a line. */
export function Marker({ x, y, color, r = MARKER_RADIUS }: { x: number; y: number; color: string; r?: number }) {
  return (
    <circle cx={x} cy={y} r={r} fill={color} stroke="var(--surface-1)" strokeWidth={SURFACE_GAP} />
  );
}

/** Hit target for a band or mark — generous, and bigger than the mark itself. */
export function HitArea({
  x,
  y,
  width,
  height,
  onEnter,
  onLeave,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  onEnter: (event: React.MouseEvent<SVGRectElement>) => void;
  onLeave: () => void;
  label: string;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(0, width)}
      height={Math.max(0, height)}
      fill="transparent"
      tabIndex={0}
      role="img"
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseMove={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter as unknown as (event: React.FocusEvent<SVGRectElement>) => void}
      onBlur={onLeave}
      className="outline-none focus-visible:[outline:2px_solid_var(--brand)]"
    />
  );
}
