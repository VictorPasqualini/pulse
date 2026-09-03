"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";

/**
 * Navigation. A left rail from md up; on a phone it collapses to a scrollable
 * row of pills pinned under the logo, which keeps the whole viewport height for
 * the charts.
 */

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Painel",
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden {...stroke}>
        <path d="M2.5 13.5V7l5.5-4.5L13.5 7v6.5" />
        <path d="M6.2 13.5v-4h3.6v4" />
      </svg>
    ),
  },
  {
    href: "/investimentos",
    label: "Investimentos",
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden {...stroke}>
        <path d="M2 12.5 5.6 8l2.6 2.2L13.8 4" />
        <path d="M10.6 4h3.2v3.2" />
      </svg>
    ),
  },
  {
    href: "/cartoes",
    label: "Cartões",
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden {...stroke}>
        <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.8" />
        <path d="M1.8 6.8h12.4M4.4 10.1h2.4" />
      </svg>
    ),
  },
  {
    href: "/lancamentos",
    label: "Lançamentos",
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden {...stroke}>
        <path d="M3 3.5h10M3 6.8h10M3 10.1h7M3 13.4h4" />
      </svg>
    ),
  },
  {
    href: "/configuracao",
    label: "Configuração",
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden {...stroke}>
        <circle cx="8" cy="8" r="2.1" />
        <path d="M8 1.8v1.6M8 12.6v1.6M2.6 8H1M15 8h-1.6M4.2 4.2 3.1 3.1M12.9 12.9l-1.1-1.1M11.8 4.2l1.1-1.1M3.1 12.9l1.1-1.1" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-hairline bg-bg-accent px-3 py-4 md:flex">
        <Link
          href="/"
          className="mb-6 flex items-center gap-2 rounded-lg px-2 py-1 text-ink transition-colors hover:bg-surface-1"
        >
          <Logo size={26} withWordmark />
        </Link>

        <nav aria-label="Seções">
          <ul className="flex flex-col gap-0.5">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                      active
                        ? "bg-brand-wash font-medium text-brand"
                        : "text-ink-2 hover:bg-surface-1 hover:text-ink"
                    }`}
                  >
                    <span className={active ? "text-brand" : "text-ink-3"}>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 px-1 pt-4">
          <span className="text-[11px] text-ink-3">Fonte: planilha</span>
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-hairline bg-bg/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-ink">
            <Logo size={24} withWordmark />
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Seções" className="overflow-x-auto px-4 pb-2.5">
          <ul className="flex w-max gap-1.5">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] whitespace-nowrap ${
                      active
                        ? "border-transparent bg-brand-wash font-medium text-brand"
                        : "border-hairline text-ink-2"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
    </>
  );
}
