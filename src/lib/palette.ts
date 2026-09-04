/**
 * Pulse palette — the single source of truth for every data colour in the app.
 *
 * Derived by running the six checks of the data-viz method (OKLCH lightness band,
 * chroma floor, protan/deutan separation, normal-vision floor, surface contrast)
 * over candidate hue orderings, not by eye. Results, ΔE in OKLab ×100:
 *
 *   categorical, adjacent pairs   dark: CVD 12.6 · normal 16.3
 *                                 light: CVD 12.6 · normal 16.3
 *   categorical, all pairs        safe for the first 3 slots in both modes; past
 *                                 that a donut/scatter must fold into "Outros".
 *   flow trio (in/out/invest)     dark: CVD 12.5 · normal 20.0
 *                                 light: CVD 12.0 · normal 23.7
 *
 * The slot ORDER is the CVD-safety mechanism, not a mood board — it was picked from
 * the orderings that clear every gate in both modes. Do not reorder, do not re-step,
 * and do not add a ninth slot without re-running the validator.
 *
 * Light mode puts the flow trio just under 3:1 against the light surface, which the
 * method allows only with a relief channel. Pulse ships two: direct value labels on
 * every chart, and the full table at /lancamentos.
 *
 * Components never read these hexes. They read the CSS custom properties emitted by
 * `paletteCSS()` — one definition, both modes, no chance of a chart drifting from a
 * validated value.
 */

export type Mode = "dark" | "light";

/** Segment identity. Fixed order, assigned in sequence, never cycled. */
export const CATEGORICAL: Record<Mode, readonly string[]> = {
  dark: ["#2f9e8f", "#3987e5", "#d95926", "#1a9fb5", "#c68410", "#d55181", "#8b7ce8", "#3fa34d"],
  light: ["#159a86", "#2a78d6", "#eb6834", "#0e9cb4", "#d99413", "#e87ba4", "#6a5ae0", "#2f9440"],
} as const;

/** The folded "Outros" slot: deliberately grey, so it never impersonates a segment. */
export const OTHER: Record<Mode, string> = { dark: "#6c7a77", light: "#8b9895" };

/** How many slots may share one chart where any two marks can touch. */
export const CATEGORICAL_ALL_PAIRS_CAP = 3;

/** Reserved money-flow meanings. Never reused as "segment 4". */
export const FLOW: Record<Mode, { in: string; out: string; invest: string }> = {
  dark: { in: "#1aa88c", out: "#c68410", invest: "#7d6ee0" },
  light: { in: "#0a8f6b", out: "#d99413", invest: "#6a5ae0" },
} as const;

/** Sequential magnitude, one hue (teal), anchored away from the surface in each mode. */
export const SEQUENTIAL: Record<Mode, readonly string[]> = {
  dark: ["#1d2b2a", "#20423d", "#226054", "#20806c", "#1aa88c", "#3fc4a6"],
  light: ["#dff0ec", "#b6ded4", "#87c8b8", "#4fae99", "#1f9179", "#0a6f5c"],
} as const;

export const SURFACE: Record<Mode, string> = { dark: "#141a18", light: "#fbfcfb" };

/* ------------------------------------------------------- what components use */

/** Colour for segment slot `i`; -1 is the folded "Outros" bucket. */
export const series = (slot: number): string =>
  slot < 0 || slot >= CATEGORICAL.dark.length ? "var(--series-other)" : `var(--series-${slot + 1})`;

export const flow = {
  in: "var(--flow-in)",
  out: "var(--flow-out)",
  invest: "var(--flow-invest)",
} as const;

/** Step `i` of the sequential ramp, 0 = nearest the surface. */
export const sequential = (step: number): string =>
  `var(--seq-${Math.min(SEQUENTIAL.dark.length, Math.max(1, step + 1))})`;

/** Pick a ramp step for a 0..1 magnitude. */
export function sequentialFor(ratio: number): string {
  const steps = SEQUENTIAL.dark.length;
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return sequential(Math.round(clamped * (steps - 1)));
}

/* ---------------------------------------------------------------- emission */

function block(mode: Mode): string {
  const lines = [
    ...CATEGORICAL[mode].map((hex, i) => `--series-${i + 1}: ${hex};`),
    `--series-other: ${OTHER[mode]};`,
    `--flow-in: ${FLOW[mode].in};`,
    `--flow-out: ${FLOW[mode].out};`,
    `--flow-invest: ${FLOW[mode].invest};`,
    ...SEQUENTIAL[mode].map((hex, i) => `--seq-${i + 1}: ${hex};`),
    `--chart-surface: ${SURFACE[mode]};`,
  ];
  return lines.map((line) => `  ${line}`).join("\n");
}

/**
 * The palette as CSS, emitted once in the document head.
 *
 * Dark sits on bare `:root` because dark is the app's designed default. Light is
 * declared twice — under an explicit `[data-theme="light"]` stamp and under a light
 * OS preference — with the media query guarded so an explicit dark choice still wins.
 */
export function paletteCSS(): string {
  return [
    `:root {\n${block("dark")}\n}`,
    `@media (prefers-color-scheme: light) {\n  :root:where(:not([data-theme="dark"])) {\n${block("light")}\n  }\n}`,
    `:root[data-theme="light"] {\n${block("light")}\n}`,
  ].join("\n");
}
