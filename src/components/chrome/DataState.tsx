import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { Logo } from "@/components/brand/Logo";

/** First run: no link saved yet, so every page shows the same three steps. */
export function Unconfigured() {
  const steps = [
    {
      title: "Abra a planilha no OneDrive",
      body: "Use o arquivo que você já mantém, do jeito que ele está. O Pulse não pede um formato novo.",
    },
    {
      title: 'Compartilhar › Copiar link',
      body: 'Em "Pessoas que você escolher", troque para "Qualquer pessoa com o link" e deixe em Pode visualizar.',
    },
    {
      title: "Cole o link na configuração",
      body: "O Pulse detecta as colunas de data, valor, tipo e segmento sozinho — e você corrige o que ele errar.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-6 py-10">
      <Logo size={40} withWordmark />

      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">
          Sua planilha, lida como um painel.
        </h1>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-2">
          Entradas e saídas por mês, gastos por segmento e por semana, cartão de crédito e uma tela
          só para os investimentos. Aporte não conta como gasto e rendimento não conta como entrada —
          eles ficam separados, onde dá para acompanhar o ganho de verdade.
        </p>
      </div>

      <Card className="w-full">
        <ol className="flex flex-col divide-y divide-hairline">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3.5 px-5 py-4">
              <span
                aria-hidden
                className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-wash text-[12px] font-semibold text-brand"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{step.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/configuracao"
          className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition-opacity hover:opacity-90"
        >
          Conectar planilha
        </Link>
        <a
          href="/api/modelo"
          className="rounded-lg border border-hairline px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-hairline-strong hover:text-ink"
        >
          Baixar planilha modelo
        </a>
      </div>
    </div>
  );
}

/** The source is set but unreachable or unreadable. The hint is the actionable half. */
export function LoadError({ message, hint }: { message: string; hint?: string }) {
  return (
    <Card className="w-full">
      <div className="flex flex-col items-start gap-3 px-5 py-6">
        <p className="text-[13px] font-semibold text-bad">Não foi possível ler a planilha</p>
        <p className="max-w-prose text-[13px] leading-relaxed text-ink">{message}</p>
        {hint && <p className="max-w-prose text-[13px] leading-relaxed text-ink-2">{hint}</p>}
        <Link
          href="/configuracao"
          className="mt-1 rounded-lg border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-hairline-strong hover:text-ink"
        >
          Revisar configuração
        </Link>
      </div>
    </Card>
  );
}
