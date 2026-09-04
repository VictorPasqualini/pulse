import type { ReactNode } from "react";

/* -------------------------------------------------------------------- card */

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    // min-w-0: a card is almost always a grid or flex item, and those default to
    // a min-content floor. Without this, anything that overflows a card — a wide
    // table, a chart mid-measure — widens the track instead of scrolling inside.
    <Tag
      className={`min-w-0 rounded-card border border-hairline bg-surface-1 shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  hint,
  aside,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{hint}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

/* --------------------------------------------------------------- stat tile */

/**
 * The stat-tile contract: label, value, optional delta against a *named* period,
 * optional trend. The value uses proportional figures because it is a standalone
 * display number — tabular figures make big numbers look loose.
 */
export function StatTile({
  label,
  value,
  delta,
  footnote,
  accent,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  footnote?: string;
  /** A hex from the palette, drawn as a short key beside the label — never on the text. */
  accent?: string;
  hero?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4">
      <div className="flex items-center gap-2">
        {accent && (
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: accent }} />
        )}
        <span className="truncate text-[12px] font-medium text-ink-2">{label}</span>
      </div>
      <span
        className={`font-semibold tracking-tight text-ink ${hero ? "text-[42px] leading-[1.05]" : "text-[26px] leading-tight"}`}
      >
        {value}
      </span>
      {delta && <div className="text-[12px]">{delta}</div>}
      {footnote && <p className="text-[12px] leading-snug text-ink-3">{footnote}</p>}
    </div>
  );
}

/**
 * A signed change with its direction spelled out in a glyph and a word, so the
 * meaning never rests on colour alone. `goodWhen` says which direction is good —
 * spending less is good, earning less is not.
 */
export function Delta({
  value,
  label,
  goodWhen = "up",
  neutral = false,
}: {
  /** Pre-formatted, already signed. */
  value: string;
  /** What it is measured against: "vs. média de 3 meses". */
  label: string;
  goodWhen?: "up" | "down";
  neutral?: boolean;
}) {
  const isUp = value.startsWith("+");
  const isFlat = neutral || (!isUp && !value.startsWith("−") && !value.startsWith("-"));
  const good = goodWhen === "up" ? isUp : !isUp;

  const tone = isFlat ? "text-ink-3" : good ? "text-good" : "text-bad";
  const arrow = isFlat ? "" : isUp ? "↗" : "↘";

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`tnum font-medium ${tone}`}>
        {arrow && <span aria-hidden>{arrow} </span>}
        {value}
      </span>
      <span className="text-ink-3">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------- misc */

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn";
}) {
  const tones = {
    neutral: "border-hairline text-ink-2",
    brand: "border-transparent bg-brand-wash text-brand",
    warn: "border-transparent bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] text-warn",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-10">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {children && <div className="max-w-prose text-[13px] leading-relaxed text-ink-2">{children}</div>}
      {action}
    </div>
  );
}

export function Divider() {
  return <div role="presentation" className="h-px w-full bg-hairline" />;
}

/** Section label above a group of cards. */
export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">{children}</h2>
      {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}
