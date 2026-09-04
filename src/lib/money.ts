const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_ROUND = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const PLAIN = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * Every negative number in Pulse wears a real minus sign (U+2212), not a hyphen.
 * At the sizes the hero figures use, a hyphen reads as a stray dash; the true
 * minus also lines up with the digits in a tabular-figure column.
 */
const MINUS = "−";

const minus = (formatted: string) => formatted.replace(/^-/, MINUS);

export const brl = (v: number) => minus(BRL.format(v));
export const brlRound = (v: number) => minus(BRL_ROUND.format(v));
export const num = (v: number) => minus(PLAIN.format(v));

/** Axis ticks and dense labels: R$ 12,4 mil / R$ 1,2 mi. */
export function brlCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (abs >= 1_000_000) return sign + "R$ " + PLAIN.format(round(abs / 1_000_000, 1)) + " mi";
  if (abs >= 1_000) return sign + "R$ " + PLAIN.format(round(abs / 1_000, 1)) + " mil";
  return sign + "R$ " + PLAIN.format(Math.round(abs));
}

export function compact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (abs >= 1_000_000) return sign + PLAIN.format(round(abs / 1_000_000, 1)) + "mi";
  if (abs >= 1_000) return sign + PLAIN.format(round(abs / 1_000, abs >= 10_000 ? 0 : 1)) + "k";
  return sign + PLAIN.format(Math.round(abs));
}

/** Signed money, for deltas. Always shows the direction in the glyph. */
export function brlSigned(v: number): string {
  if (v === 0) return brl(0);
  return (v > 0 ? "+" : MINUS) + BRL.format(Math.abs(v));
}

export function pct(v: number, digits = 1): string {
  return minus(PLAIN.format(round(v * 100, digits))) + "%";
}

export function pctSigned(v: number, digits = 1): string {
  const s = PLAIN.format(round(Math.abs(v) * 100, digits));
  if (v === 0) return "0%";
  return (v > 0 ? "+" : MINUS) + s + "%";
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Percentage change, or null when there is no base to compare against. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
