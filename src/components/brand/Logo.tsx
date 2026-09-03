import { useId } from "react";

/**
 * Pulse — the mark.
 *
 * A single ECG stroke: a flat run, one beat, and a step that lands higher than it
 * started. It reads as a heartbeat at a glance and as growth on a second look,
 * which is the whole idea — money you can feel the rhythm of.
 *
 * The gradient runs lime → mint → cyan: lime for growth, mint for money, cyan for
 * the cool, factual end of the scale. It is deliberately not the "green = good,
 * red = bad" pair, because the app's job is to show you a rhythm, not to scold.
 *
 * Two variants, both live in one path so they never drift apart:
 *   "stroke"  — the line alone, for the sidebar and headers.
 *   "tile"    — the line knocked out of a filled squircle, for favicons and app
 *               icons, where a container keeps it legible at 16px.
 */

/** Flat run, a small pre-beat, the spike, and a step that lands above the start. */
const PULSE_PATH = "M2.5 13h4.1l1.5-2.4 1.3 2.4h1.3l1.9-7.2 2.8 12.8 1.9-7.6h3.8";

export function Mark({
  size = 24,
  variant = "stroke",
  className,
}: {
  size?: number;
  variant?: "stroke" | "tile";
  className?: string;
}) {
  const id = useId();
  const gradientId = `pulse-grad-${id}`;
  const maskId = `pulse-mask-${id}`;

  if (variant === "tile") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        role="img"
        aria-label="Pulse"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0">
            <stop offset="0%" stopColor="var(--pulse-a)" />
            <stop offset="52%" stopColor="var(--pulse-b)" />
            <stop offset="100%" stopColor="var(--pulse-c)" />
          </linearGradient>
          <mask id={maskId}>
            <rect width="24" height="24" fill="#fff" />
            <path
              d={PULSE_PATH}
              fill="none"
              stroke="#000"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        {/* 7.2 on 24 is a squircle-ish 30% radius: soft enough to sit next to
            rounded UI, square enough to hold the stroke at small sizes. */}
        <rect width="24" height="24" rx="7.2" fill={`url(#${gradientId})`} mask={`url(#${maskId})`} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Pulse"
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="19" x2="21" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--pulse-a)" />
          <stop offset="52%" stopColor="var(--pulse-b)" />
          <stop offset="100%" stopColor="var(--pulse-c)" />
        </linearGradient>
      </defs>
      <path
        d={PULSE_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is set in the app's own sans at a tight
 * tracking rather than drawn as outlines — deliberate for now, and the one thing
 * to redraw the day Pulse needs a real trademark.
 */
export function Logo({
  size = 22,
  className,
  withWordmark = true,
}: {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Mark size={size} />
      {withWordmark && (
        <span
          className="font-semibold text-ink"
          style={{ fontSize: size * 0.82, letterSpacing: "-0.025em" }}
        >
          Pulse
        </span>
      )}
    </span>
  );
}
