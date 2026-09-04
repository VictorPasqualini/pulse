import { LINE_WIDTH } from "./specs";

/**
 * The shape of a trend beside a number. No axes and no hover: the tile already
 * states the value, and this only answers "rising or falling?". Its own baseline
 * is the series minimum, so it exaggerates on purpose — never read amounts off it.
 */
export function Sparkline({
  values,
  color,
  label,
  width = 96,
  height = 28,
}: {
  values: number[];
  color: string;
  /** Spoken description, since the shape carries no labels. */
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = LINE_WIDTH + 1;

  const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="block"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill={color} />
    </svg>
  );
}
