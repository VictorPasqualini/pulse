import type { ReactNode } from "react";

/** Page title, one-line orientation, and the filter row — in that order, always. */
export function PageHeader({
  title,
  subtitle,
  actions,
  filters,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </header>
  );
}

/** The page frame: one max width, one gutter, used by every route. */
export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-8 md:py-8">{children}</main>;
}
