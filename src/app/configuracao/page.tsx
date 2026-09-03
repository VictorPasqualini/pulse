import type { Metadata } from "next";
import Link from "next/link";
import { readConfig } from "@/lib/config";
import { inspectSource, loadDataset } from "@/lib/source";
import { SourceError } from "@/lib/onedrive";
import { FIELD_HINT, FIELD_LABEL, type Field } from "@/lib/types";
import type { Cell } from "@/lib/xlsx/reader";
import { PageHeader, PageShell } from "@/components/chrome/PageHeader";
import { Card, CardHeader, Divider, Pill } from "@/components/ui/primitives";
import { resetColumns, saveColumns, saveRules, saveSource } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuração",
  description: "Link da planilha, mapeamento de colunas e as regras de classificação.",
};

const FIELD_ORDER: Field[] = [
  "date",
  "description",
  "amount",
  "amountIn",
  "amountOut",
  "flow",
  "segment",
  "account",
  "method",
  "card",
  "asset",
  "installment",
  "note",
];

const INPUT =
  "w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-brand";
const BUTTON =
  "rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition-opacity hover:opacity-90";
const GHOST =
  "rounded-lg border border-hairline px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-hairline-strong hover:text-ink";

export default async function ConfigPage() {
  const config = await readConfig();

  let inspection: Awaited<ReturnType<typeof inspectSource>> | null = null;
  let inspectionError: { message: string; hint?: string } | null = null;

  if (config.sourceUrl) {
    try {
      inspection = await inspectSource(config);
    } catch (error) {
      inspectionError =
        error instanceof SourceError
          ? { message: error.message, hint: error.hint }
          : { message: error instanceof Error ? error.message : "Falha ao ler a planilha." };
    }
  }

  const dataset = config.sourceUrl ? await loadDataset() : null;
  const applied = dataset?.status === "ok" ? dataset.dataset.columns : {};
  const headers = inspection?.headers ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Configuração"
        subtitle="O Pulse não guarda seus lançamentos: ele só guarda como ler a sua planilha."
      />

      <Card className="mb-5">
        <CardHeader
          title="Planilha"
          hint='No OneDrive: Compartilhar › Copiar link, com "Qualquer pessoa com o link" e permissão de visualização.'
        />
        <form action={saveSource} className="flex flex-col gap-4 px-5 pb-5">
          <div>
            <label htmlFor="sourceUrl" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Link ou caminho do arquivo
            </label>
            <input
              id="sourceUrl"
              name="sourceUrl"
              type="text"
              defaultValue={config.sourceUrl}
              placeholder="https://1drv.ms/x/…  ou  C:\Users\voce\Documents\financas.xlsx"
              className={INPUT}
            />
            <p className="mt-1.5 text-[12px] leading-snug text-ink-3">
              Funciona com OneDrive, SharePoint, Dropbox, qualquer URL direta para .xlsx ou .csv, e
              também com um arquivo local desta máquina.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sheetName"
                className="mb-1.5 block text-[12.5px] font-medium text-ink-2"
              >
                Aba
              </label>
              {inspection && inspection.sheets.length > 1 ? (
                <select
                  id="sheetName"
                  name="sheetName"
                  defaultValue={config.sheetName}
                  className={INPUT}
                >
                  <option value="">Primeira aba ({inspection.sheets[0]?.name})</option>
                  {inspection.sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="sheetName"
                  name="sheetName"
                  type="text"
                  defaultValue={config.sheetName}
                  placeholder="Primeira aba"
                  className={INPUT}
                />
              )}
            </div>

            <div>
              <label
                htmlFor="headerRow"
                className="mb-1.5 block text-[12.5px] font-medium text-ink-2"
              >
                Linha do cabeçalho
              </label>
              <input
                id="headerRow"
                name="headerRow"
                type="number"
                min={1}
                defaultValue={config.headerRow != null ? config.headerRow + 1 : ""}
                placeholder={
                  inspection ? `Detectada: linha ${inspection.headerRow + 1}` : "Detectar sozinho"
                }
                className={INPUT}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={BUTTON}>
              Salvar e ler
            </button>
            <a href="/api/modelo" className={GHOST}>
              Baixar planilha modelo
            </a>
            {config.updatedAt && (
              <span className="text-[12px] text-ink-3">
                Última alteração: {new Date(config.updatedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </form>

        {inspectionError && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <p className="text-[13px] font-medium text-bad">{inspectionError.message}</p>
              {inspectionError.hint && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  {inspectionError.hint}
                </p>
              )}
            </div>
          </>
        )}

        {inspection && (
          <>
            <Divider />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 text-[12px] text-ink-3">
              <span>{inspection.label}</span>
              <span>
                Aba <span className="text-ink-2">{inspection.usedSheet}</span>
              </span>
              <span>
                Cabeçalho na linha <span className="tnum text-ink-2">{inspection.headerRow + 1}</span>
              </span>
              <span>
                <span className="tnum text-ink-2">{headers.length}</span> colunas
              </span>
              {dataset?.status === "ok" && (
                <span>
                  <span className="tnum text-ink-2">{dataset.dataset.transactions.length}</span>{" "}
                  lançamentos lidos
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {inspection && (
        <Card className="mb-5">
          <CardHeader
            title="Colunas"
            hint="O Pulse tenta adivinhar pelo nome do cabeçalho. Corrija só o que ele errou; o resto pode ficar em automático."
            aside={
              dataset?.status === "ok" && dataset.dataset.autoMapped ? (
                <Pill tone="brand">Tudo automático</Pill>
              ) : (
                <Pill>Ajustado manualmente</Pill>
              )
            }
          />
          <form action={saveColumns} className="px-5 pb-5">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELD_ORDER.map((field) => {
                const detected = applied[field];
                const pinned = config.columns[field];
                return (
                  <div key={field}>
                    <label
                      htmlFor={`col-${field}`}
                      className="mb-1.5 flex items-baseline gap-2 text-[12.5px] font-medium text-ink-2"
                    >
                      {FIELD_LABEL[field]}
                      {!pinned && detected && (
                        <span className="text-[11px] font-normal text-ink-3">auto</span>
                      )}
                    </label>
                    <select
                      id={`col-${field}`}
                      name={`col.${field}`}
                      defaultValue={pinned ?? ""}
                      className={INPUT}
                    >
                      <option value="">
                        {detected ? `Automático — ${detected}` : "Automático — não encontrada"}
                      </option>
                      {headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={header}>
                          {header || `(coluna ${index + 1})`}
                        </option>
                      ))}
                    </select>
                    {FIELD_HINT[field] && (
                      <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
                        {FIELD_HINT[field]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" className={BUTTON}>
                Salvar mapeamento
              </button>
              <button type="submit" formAction={resetColumns} className={GHOST}>
                Voltar tudo para automático
              </button>
            </div>
          </form>

          {inspection.sample.length > 0 && (
            <>
              <Divider />
              <div className="overflow-x-auto px-5 py-4">
                <p className="mb-2 text-[12px] text-ink-3">Primeiras linhas da planilha</p>
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11.5px] text-ink-3">
                      {headers.map((header, index) => (
                        <th
                          key={`${header}-${index}`}
                          className="py-2 pr-4 font-medium whitespace-nowrap"
                        >
                          {header || `col ${index + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspection.sample.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-hairline last:border-0">
                        {headers.map((_, columnIndex) => (
                          <td
                            key={columnIndex}
                            className="py-2 pr-4 whitespace-nowrap text-ink-2"
                          >
                            {show(row[columnIndex])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title="Regras de classificação"
          hint="É o que separa investimento de gasto. Um termo por linha, sem acento ou com — a comparação ignora acentuação e maiúsculas."
        />
        <form action={saveRules} className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-2">
          <Terms
            name="investmentTerms"
            label="Marcam um lançamento como investimento"
            hint="Saída com esses termos vira aporte, não gasto."
            value={config.rules.investmentTerms}
          />
          <Terms
            name="yieldTerms"
            label="Marcam rendimento (lucro ou perda)"
            hint="Entra e sai do resultado do investimento, nunca do fluxo de caixa."
            value={config.rules.yieldTerms}
          />
          <Terms
            name="withdrawTerms"
            label="Marcam resgate de principal"
            hint="Entrada que é devolução do que já foi aportado."
            value={config.rules.withdrawTerms}
          />
          <Terms
            name="creditTerms"
            label="Significam cartão de crédito"
            hint="Usados quando não existe uma coluna de cartão."
            value={config.rules.creditTerms}
          />
          <Terms
            name="ignoredSegments"
            label="Segmentos a ignorar"
            hint="Transferências entre contas, saldo inicial, ajustes."
            value={config.rules.ignoredSegments}
          />

          <div className="flex items-end">
            <div className="flex flex-col gap-2">
              <button type="submit" className={BUTTON}>
                Salvar regras
              </button>
              <p className="text-[11.5px] leading-snug text-ink-3">
                Deixar um campo vazio restaura a lista padrão dele.
              </p>
            </div>
          </div>
        </form>
      </Card>

      <p className="mt-5 text-[12px] leading-relaxed text-ink-3">
        Tudo isso fica em <code className="text-ink-2">.pulse/config.json</code>, fora do Git. Nada
        dos seus lançamentos é copiado ou enviado para lugar nenhum — o Pulse lê a planilha,
        calcula e mostra.{" "}
        <Link href="/" className="text-brand hover:underline">
          Voltar ao painel
        </Link>
      </p>
    </PageShell>
  );
}

function Terms({
  name,
  label,
  hint,
  value,
}: {
  name: string;
  label: string;
  hint: string;
  value: readonly string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={5}
        defaultValue={value.join("\n")}
        className={`${INPUT} font-mono text-[12px] leading-relaxed`}
      />
      <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{hint}</p>
    </div>
  );
}

function show(cell: Cell): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toLocaleDateString("pt-BR");
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return cell ? "sim" : "não";
  return cell;
}
