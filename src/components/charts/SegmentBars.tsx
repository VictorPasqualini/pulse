import Link from "next/link";
import { flow, series } from "@/lib/palette";
import { brl, pct } from "@/lib/money";
import type { Slice } from "@/lib/metrics";
import { Empty } from "@/components/ui/primitives";

/**
 * Segment ranking. Horizontal bars because the labels are words of very different
 * length, and because rank is easiest to read down a column.
 *
 * One hue for every bar, not one per segment. The story here is magnitude and the
 * bar length already tells it; a colour per row would spend the identity channel
 * on information the chart shows twice. Worse, the slots are handed out by rank,
 * so switching months would repaint a segment that merely moved up the list — the
 * reader who learned "Mercado is the lime one" would be misled. Only the folded
 * "Outros" row gets its own muted tone, because it is not a segment at all.
 *
 * Every row already shows its exact value and share, so there is nothing for a
 * tooltip to reveal; the hover affordance is a drill-down into the matching rows
 * instead, which is the question a reader actually has next.
 */
export function SegmentBars({
  slices,
  month,
  tone = flow.out,
  emptyLabel = "Nenhum lançamento no período.",
}: {
  slices: Slice[];
  /** Passed through to the drill-down link so the table opens on the same month. */
  month?: string;
  /** The measure being ranked — saídas by default, entradas on the income card. */
  tone?: string;
  emptyLabel?: string;
}) {
  if (slices.length === 0) return <Empty title={emptyLabel} />;

  const peak = Math.max(...slices.map((slice) => slice.amount), 1);

  return (
    <ul className="flex flex-col px-2 pb-2">
      {slices.map((slice) => {
        const href = {
          pathname: "/lancamentos",
          query: {
            ...(month ? { mes: month } : {}),
            ...(slice.slot >= 0 ? { segmento: slice.name } : {}),
          },
        };

        return (
          <li key={slice.name}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <span className="w-[38%] min-w-0 shrink-0 truncate text-[12.5px] text-ink-2 group-hover:text-ink">
                {slice.name}
              </span>

              <span className="relative h-3 min-w-0 flex-1">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{
                    width: `${Math.max(1.5, (slice.amount / peak) * 100)}%`,
                    background: slice.slot < 0 ? series(-1) : tone,
                  }}
                />
              </span>

              <span className="tnum w-24 shrink-0 text-right text-[12.5px] font-medium text-ink">
                {brl(slice.amount)}
              </span>
              <span className="tnum w-11 shrink-0 text-right text-[12px] text-ink-3">
                {pct(slice.share, 0)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
