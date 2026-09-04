import type { Cell } from "@/lib/xlsx/reader";
import type { Dataset, PulseConfig, SheetMeta } from "@/lib/types";
import type { Workbook } from "@/lib/xlsx/reader";
import { readWorkbook } from "@/lib/xlsx/reader";
import { parseCSV } from "@/lib/csv";
import { autoMap, mergeColumns } from "@/lib/mapping";
import { normalizeRows } from "@/lib/normalize";
import { fetchSource, SourceError } from "@/lib/onedrive";
import { readConfig } from "@/lib/config";

/**
 * Read the sheet, turn it into transactions, hold the result briefly.
 *
 * The cache exists so that navigating between the four screens does not re-download
 * the workbook on every render; it is short enough (60s) that "I just added a row"
 * still means "it shows up when I look", and the Atualizar button bypasses it.
 */

export type LoadResult =
  | { status: "ok"; dataset: Dataset }
  | { status: "unconfigured" }
  | { status: "error"; message: string; hint?: string };

interface CacheEntry {
  key: string;
  at: number;
  dataset: Dataset;
}

const TTL_MS = 60_000;
let cache: CacheEntry | null = null;

function cacheKey(config: PulseConfig): string {
  return JSON.stringify([
    config.sourceUrl,
    config.sheetName,
    config.headerRow,
    config.columns,
    config.rules,
  ]);
}

export async function loadDataset(options: { force?: boolean } = {}): Promise<LoadResult> {
  const config = await readConfig();
  if (!config.sourceUrl) return { status: "unconfigured" };

  const key = cacheKey(config);
  if (!options.force && cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
    return { status: "ok", dataset: cache.dataset };
  }

  try {
    const dataset = await build(config);
    cache = { key, at: Date.now(), dataset };
    return { status: "ok", dataset };
  } catch (error) {
    if (error instanceof SourceError) {
      return { status: "error", message: error.message, hint: error.hint };
    }
    const message = error instanceof Error ? error.message : "Falha ao ler a planilha.";
    return { status: "error", message };
  }
}

/** Everything the /configuracao screen needs to show a mapping form, even when
 *  the current mapping produces zero usable rows. */
export async function inspectSource(config: PulseConfig): Promise<{
  sheets: SheetMeta[];
  usedSheet: string;
  headers: string[];
  headerRow: number;
  sample: Cell[][];
  label: string;
}> {
  const file = await fetchSource(config.sourceUrl);
  const { rows, sheets, usedSheet } = grid(file, config.sheetName);
  const auto = autoMap(rows, config.headerRow);
  return {
    sheets,
    usedSheet,
    headers: auto.headers,
    headerRow: auto.headerRow,
    sample: rows.slice(auto.headerRow + 1, auto.headerRow + 9),
    label: file.label,
  };
}

async function build(config: PulseConfig): Promise<Dataset> {
  const file = await fetchSource(config.sourceUrl);
  const { rows, sheets, usedSheet } = grid(file, config.sheetName);

  const auto = autoMap(rows, config.headerRow);
  const columns = mergeColumns(auto.columns, config.columns);
  const userPinned = Object.values(config.columns).some((v) => typeof v === "string" && v !== "");

  if (!columns.date) {
    throw new SourceError(
      "Não encontrei a coluna de data.",
      "Abra Configuração e aponte manualmente qual coluna guarda a data.",
    );
  }
  if (!columns.amount && !columns.amountIn && !columns.amountOut) {
    throw new SourceError(
      "Não encontrei a coluna de valor.",
      "Abra Configuração e aponte a coluna de valor, ou as duas colunas de entrada e saída.",
    );
  }

  const { transactions, issues } = normalizeRows(
    rows,
    auto.headerRow,
    columns,
    config.rules,
    usedSheet,
  );

  return {
    transactions,
    sheets,
    usedSheet,
    columns,
    autoMapped: !userPinned,
    issues: issues.slice(0, 200),
    fetchedAt: new Date().toISOString(),
    sourceLabel: file.label,
  };
}

function grid(
  file: { bytes: Uint8Array; format: "xlsx" | "csv" },
  sheetName: string,
): { rows: Cell[][]; sheets: SheetMeta[]; usedSheet: string } {
  if (file.format === "csv") {
    const rows = parseCSV(new TextDecoder("utf-8").decode(file.bytes));
    const name = "CSV";
    return {
      rows,
      sheets: [{ name, headers: (rows[0] ?? []).map(String), rowCount: Math.max(0, rows.length - 1) }],
      usedSheet: name,
    };
  }

  const workbook = readWorkbook(file.bytes);
  const wanted =
    sheetName && workbook.sheetNames.includes(sheetName) ? sheetName : pickLedgerSheet(workbook);
  const rows = workbook.sheet(wanted);

  // Header lists for the other sheets are read lazily on the config screen only;
  // here we just need names and sizes for the picker.
  const sheets: SheetMeta[] = workbook.sheetNames.map((name) => {
    if (name !== wanted) return { name, headers: [], rowCount: 0 };
    const auto = autoMap(rows, null);
    return { name, headers: auto.headers, rowCount: Math.max(0, rows.length - auto.headerRow - 1) };
  });

  return { rows, sheets, usedSheet: wanted };
}

/**
 * Which tab holds the ledger.
 *
 * A real workbook is not one table. A spreadsheet someone actually keeps grows a
 * planning tab, a balance tab, a weekly summary, a payroll history — and the
 * transactions can sit anywhere among them. Reading sheet 1 and reporting "não
 * encontrei a coluna de data" is a dead end the user has no way to debug, so
 * instead every sheet is auto-mapped and scored on whether it looks like a ledger
 * at all: a date, a value, a description, and rows underneath them. Ties go to the
 * earliest tab, and the picker on /configuracao overrides the guess.
 */
function pickLedgerSheet(workbook: Workbook): string {
  let best = workbook.sheetNames[0] ?? "";
  let bestScore = -Infinity;

  for (const name of workbook.sheetNames) {
    let rows: Cell[][];
    try {
      rows = workbook.sheet(name);
    } catch {
      continue;
    }

    const auto = autoMap(rows, null);
    const body = rows.length - auto.headerRow - 1;
    if (body < 1) continue;

    const hasAmount = Boolean(auto.columns.amount || auto.columns.amountIn || auto.columns.amountOut);
    const score =
      (auto.columns.date ? 4 : 0) +
      (hasAmount ? 4 : 0) +
      (auto.columns.description ? 2 : 0) +
      (auto.columns.segment ? 1 : 0) +
      // A tie-break, not a factor: a summary tab can map cleanly and still be the
      // wrong answer, and the ledger is nearly always the longest sheet.
      Math.min(2, Math.log10(body));

    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}

/** Drop the dataset cache so the next read hits the network. */
export function invalidateDataset(): void {
  cache = null;
}
