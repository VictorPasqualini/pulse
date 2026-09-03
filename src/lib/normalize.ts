import type { Cell } from "@/lib/xlsx/reader";
import type { ColumnMap, Flow, ParseIssue, Rules, Transaction } from "@/lib/types";
import { parseDate } from "@/lib/dates";
import { classify, looksLikeCredit } from "@/lib/classify";
import { fold, matchesAny } from "@/lib/text";
import { normalizeHeader } from "@/lib/mapping";

export const NO_SEGMENT = "Sem segmento";

const IN_WORDS = ["entrada", "entradas", "receita", "receitas", "credito", "c", "in", "recebimento", "ganho", "+", "e"];
const OUT_WORDS = ["saida", "saidas", "despesa", "despesas", "debito", "d", "out", "pagamento", "gasto", "custo", "-", "s"];

export interface NormalizeResult {
  transactions: Transaction[];
  issues: ParseIssue[];
}

export function normalizeRows(
  rows: Cell[][],
  headerRow: number,
  columns: ColumnMap,
  rules: Rules,
  sheetName: string,
): NormalizeResult {
  const headers = (rows[headerRow] ?? []).map((c) => String(c ?? "").trim());
  const index = buildIndex(headers);

  const at = (row: Cell[], header: string | undefined): Cell => {
    if (!header) return null;
    const col = index.get(normalizeHeader(header));
    return col == null ? null : row[col] ?? null;
  };

  const transactions: Transaction[] = [];
  const issues: ParseIssue[] = [];

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    // Spreadsheet line number, so an issue points at what the user sees in Excel.
    const line = r + 1;
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;

    const iso = parseDate(at(row, columns.date));
    if (!iso) {
      // Totals rows and section separators land here; only complain when the row
      // otherwise looks like real data.
      const hasValue = readAmount(at(row, columns.amount)) != null
        || readAmount(at(row, columns.amountIn)) != null
        || readAmount(at(row, columns.amountOut)) != null;
      if (hasValue) issues.push({ sheet: sheetName, row: line, reason: "Data ausente ou em formato não reconhecido." });
      continue;
    }

    const resolved = resolveAmount(row, columns, at);
    if (resolved == null) {
      issues.push({ sheet: sheetName, row: line, reason: "Valor ausente ou não numérico." });
      continue;
    }
    if (resolved.amount === 0) continue;

    const description = str(at(row, columns.description));
    const rawSegment = str(at(row, columns.segment));
    const segment = rawSegment || NO_SEGMENT;

    if (rawSegment && matchesAny(rawSegment, rules.ignoredSegments)) continue;

    const account = str(at(row, columns.account));
    const method = str(at(row, columns.method));
    const asset = str(at(row, columns.asset)) || null;
    const note = str(at(row, columns.note));
    const installment = str(at(row, columns.installment)) || null;

    const cardCell = str(at(row, columns.card));
    const card = cardCell
      ? cardCell
      : looksLikeCredit(null, method, description, rules)
        ? method || "Crédito"
        : null;

    const bucket = classify(
      { flow: resolved.flow, segment, description, asset, method, account },
      rules,
    );

    transactions.push({
      id: `${sheetName}:${line}`,
      date: iso,
      description,
      amount: resolved.amount,
      flow: resolved.flow,
      bucket,
      segment,
      account,
      method,
      card,
      asset,
      installment,
      note,
      sheet: sheetName,
      row: line,
    });
  }

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row));
  return { transactions, issues };
}

/** Header lookup is by folded name so trailing spaces in the sheet do not break
 *  a mapping the user saved yesterday. */
function buildIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, i) => {
    const key = normalizeHeader(header);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

const str = (cell: Cell): string => {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
};

type Reader = (row: Cell[], header: string | undefined) => Cell;

function resolveAmount(
  row: Cell[],
  columns: ColumnMap,
  at: Reader,
): { amount: number; flow: Flow } | null {
  // Split columns: whichever side is filled decides the direction.
  if (columns.amountIn || columns.amountOut) {
    const inValue = readAmount(at(row, columns.amountIn));
    const outValue = readAmount(at(row, columns.amountOut));
    const hasIn = inValue != null && Math.abs(inValue) > 0;
    const hasOut = outValue != null && Math.abs(outValue) > 0;
    if (hasIn && !hasOut) return { amount: Math.abs(inValue), flow: "in" };
    if (hasOut && !hasIn) return { amount: Math.abs(outValue), flow: "out" };
    if (hasIn && hasOut) {
      // Both filled: treat it as a net movement rather than dropping the row.
      const net = Math.abs(inValue) - Math.abs(outValue);
      return { amount: Math.abs(net), flow: net >= 0 ? "in" : "out" };
    }
    if (!columns.amount) return null;
  }

  const value = readAmount(at(row, columns.amount));
  if (value == null) return null;

  const flowCell = str(at(row, columns.flow));
  const declared = readFlow(flowCell);
  if (declared) return { amount: Math.abs(value), flow: declared };

  // No type column: the sign carries the direction, and an unsigned sheet is
  // read as spending — that is the overwhelmingly common case.
  return { amount: Math.abs(value), flow: value > 0 ? "in" : "out" };
}

function readFlow(value: string): Flow | null {
  const folded = fold(value);
  if (!folded) return null;
  if (IN_WORDS.includes(folded)) return "in";
  if (OUT_WORDS.includes(folded)) return "out";
  // Longer phrases: "saída de caixa", "receita recorrente".
  for (const word of OUT_WORDS) if (word.length > 2 && folded.includes(word)) return "out";
  for (const word of IN_WORDS) if (word.length > 2 && folded.includes(word)) return "in";
  return null;
}

/**
 * Money as typed by humans: "R$ 1.234,56", "1,234.56", "(120,00)" for negative,
 * "-R$ 80", "1234.56". The decimal separator is decided by which of . or , sits
 * last, which is what disambiguates 1.234 (thousands) from 1.234 (a number).
 */
export function readAmount(cell: Cell): number | null {
  if (cell == null || cell === "") return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell === "boolean" || cell instanceof Date) return null;

  let raw = String(cell).trim();
  if (!raw) return null;

  const parenthesised = /^\(.*\)$/.test(raw);
  if (parenthesised) raw = raw.slice(1, -1);

  const negative = parenthesised || /^-/.test(raw) || /-$/.test(raw);
  raw = raw.replace(/[^\d.,]/g, "");
  if (!raw || !/\d/.test(raw)) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma > lastDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    raw = raw.replace(/,/g, "");
  } else {
    raw = raw.replace(/[.,]/g, "");
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
