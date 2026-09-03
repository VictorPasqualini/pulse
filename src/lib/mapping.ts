import type { Cell } from "@/lib/xlsx/reader";
import type { ColumnMap, Field } from "@/lib/types";
import { parseDate } from "@/lib/dates";
import { deaccent } from "@/lib/text";

/**
 * Header detection.
 *
 * Pulse reads whatever spreadsheet you already keep, so it has to guess which
 * column is which. The guess is a keyword score per field, resolved greedily so
 * one header never feeds two fields, plus a header-row sniff for sheets that
 * start with a title or a couple of blank rows. Every guess is overridable at
 * /configuracao — the heuristic is a good first draft, not an authority.
 */

type Signals = { exact: string[]; strong: string[]; weak: string[] };

const SIGNALS: Record<Field, Signals> = {
  date: {
    exact: ["data", "date", "dia"],
    strong: ["data lancamento", "data do lancamento", "data pagamento", "data compra", "competencia", "vencimento"],
    weak: ["dt", "quando", "periodo"],
  },
  description: {
    exact: ["descricao", "description", "historico", "lancamento", "item"],
    strong: ["descricao do lancamento", "detalhe", "detalhes", "memo", "titulo", "estabelecimento"],
    weak: ["nome", "referencia", "o que"],
  },
  amount: {
    exact: ["valor", "amount", "montante", "value"],
    strong: ["valor r$", "valor total", "total", "valor do lancamento", "preco"],
    weak: ["r$", "quantia"],
  },
  amountIn: {
    exact: ["entrada", "entradas", "receita", "receitas", "credito", "creditos"],
    strong: ["valor entrada", "recebido", "recebimentos", "income", "ganhos"],
    weak: ["in", "haver"],
  },
  amountOut: {
    exact: ["saida", "saidas", "despesa", "despesas", "gasto", "gastos", "debito", "debitos"],
    strong: ["valor saida", "pago", "pagamentos", "expense", "custo"],
    weak: ["out", "dever"],
  },
  flow: {
    exact: ["tipo", "type", "fluxo", "movimento", "natureza"],
    strong: ["tipo de lancamento", "entrada/saida", "e/s", "operacao", "sinal", "direcao"],
    weak: ["mov", "cd"],
  },
  segment: {
    exact: ["segmento", "categoria", "category", "grupo", "classe"],
    strong: ["segmentos", "categorias", "rubrica", "area", "centro de custo", "subcategoria"],
    weak: ["tag", "setor"],
  },
  account: {
    exact: ["conta", "banco", "account", "carteira"],
    strong: ["conta bancaria", "instituicao", "origem", "bank"],
    weak: ["fonte"],
  },
  method: {
    exact: ["forma de pagamento", "forma", "pagamento", "metodo", "meio"],
    strong: ["meio de pagamento", "metodo de pagamento", "payment", "payment method", "modalidade"],
    weak: ["como", "via"],
  },
  card: {
    exact: ["cartao", "cartao de credito", "card"],
    strong: ["cartoes", "credit card", "nome do cartao", "bandeira", "fatura"],
    weak: ["cc"],
  },
  asset: {
    exact: ["ativo", "ativos", "aplicacao", "investimento", "produto"],
    strong: ["classe de ativo", "papel", "ticker", "fundo", "corretora", "asset"],
    weak: ["onde", "veiculo"],
  },
  installment: {
    exact: ["parcela", "parcelas", "installment"],
    strong: ["parcelamento", "n parcelas", "qtd parcelas"],
    weak: ["x"],
  },
  note: {
    exact: ["observacao", "observacoes", "obs", "nota", "notas", "note", "notes"],
    strong: ["comentario", "comentarios", "detalhe adicional"],
    weak: ["extra"],
  },
};

/** Fields that never win by a weak signal alone — too easy to grab a stray column. */
const STRICT: ReadonlySet<Field> = new Set(["installment", "note", "asset", "card"]);

export function normalizeHeader(value: unknown): string {
  return deaccent(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(header: string, field: Field): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  const s = SIGNALS[field];

  if (s.exact.includes(h)) return 100;
  if (s.strong.includes(h)) return 90;

  let best = 0;
  for (const term of s.strong) {
    if (h.includes(term)) best = Math.max(best, 70);
  }
  for (const term of s.exact) {
    if (h === term) best = Math.max(best, 100);
    else if (h.startsWith(term + " ") || h.endsWith(" " + term)) best = Math.max(best, 68);
    else if (h.includes(term)) best = Math.max(best, 52);
  }
  if (best === 0 && !STRICT.has(field)) {
    for (const term of s.weak) {
      if (h === term) best = Math.max(best, 40);
      else if (h.split(" ").includes(term)) best = Math.max(best, 30);
    }
  }
  return best;
}

/**
 * Where the table actually starts. Scores each of the first rows on how many
 * fields its cells look like, breaking ties toward the row with more filled text
 * cells and a data row underneath it.
 */
export function detectHeaderRow(rows: Cell[][]): number {
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    const filled = row.filter((c) => c != null && String(c).trim() !== "");
    if (filled.length < 2) continue;

    // A header row is text, not numbers or dates.
    const textish = filled.filter((c) => typeof c === "string" && !/^-?[\d.,]+$/.test(c.trim()));
    let matched = 0;
    for (const field of Object.keys(SIGNALS) as Field[]) {
      if (row.some((c) => score(String(c ?? ""), field) >= 68)) matched++;
    }

    const total = matched * 10 + textish.length + (rows[i + 1]?.length ? 2 : 0);
    if (total > bestScore) {
      bestScore = total;
      best = i;
    }
  }

  return best;
}

export interface AutoMapResult {
  headerRow: number;
  headers: string[];
  columns: ColumnMap;
  /** Fields Pulse could not find. `date` or a value field missing means trouble. */
  missing: Field[];
}

export function autoMap(rows: Cell[][], pinnedHeaderRow?: number | null): AutoMapResult {
  const headerRow = pinnedHeaderRow ?? detectHeaderRow(rows);
  const headers = (rows[headerRow] ?? []).map((c) => String(c ?? "").trim());

  // Score every (header, field) pair, then hand out the highest scores first so a
  // header like "Valor entrada" lands on amountIn rather than on amount.
  const pairs: { header: string; field: Field; value: number }[] = [];
  headers.forEach((header) => {
    if (!header) return;
    for (const field of Object.keys(SIGNALS) as Field[]) {
      const value = score(header, field);
      if (value >= 30) pairs.push({ header, field, value });
    }
  });
  pairs.sort((a, b) => b.value - a.value || a.field.localeCompare(b.field));

  const columns: ColumnMap = {};
  const takenHeaders = new Set<string>();
  for (const p of pairs) {
    if (columns[p.field] || takenHeaders.has(p.header)) continue;
    columns[p.field] = p.header;
    takenHeaders.add(p.header);
  }

  // Split in/out columns win over a single amount column: if both sides exist,
  // a lone "amount" is almost always a running total we should not read.
  if (columns.amountIn && columns.amountOut) delete columns.amount;
  if (!columns.amount && !columns.amountIn && !columns.amountOut) {
    const numeric = guessNumericColumn(rows, headerRow, headers, takenHeaders);
    if (numeric) {
      columns.amount = numeric;
      takenHeaders.add(numeric);
    }
  }
  if (!columns.date) {
    const dateish = guessDateColumn(rows, headerRow, headers, takenHeaders);
    if (dateish) columns.date = dateish;
  }

  const missing: Field[] = [];
  if (!columns.date) missing.push("date");
  if (!columns.amount && !columns.amountIn && !columns.amountOut) missing.push("amount");
  if (!columns.segment) missing.push("segment");

  return { headerRow, headers, columns, missing };
}

/** Last resort: the column whose body is mostly money-shaped. */
function guessNumericColumn(
  rows: Cell[][],
  headerRow: number,
  headers: string[],
  taken: Set<string>,
): string | null {
  const body = rows.slice(headerRow + 1, headerRow + 41);
  let bestHeader: string | null = null;
  let bestHits = 0;

  headers.forEach((header, col) => {
    if (!header || taken.has(header)) return;
    let hits = 0;
    for (const row of body) {
      const cell = row?.[col];
      if (cell == null || cell === "") continue;
      if (typeof cell === "number") hits++;
      else if (typeof cell === "string" && /\d/.test(cell) && /^[-+()\s.,\dR$]+$/i.test(cell)) hits++;
    }
    if (hits >= 3 && hits > bestHits) {
      bestHeader = header;
      bestHits = hits;
    }
  });

  return bestHeader;
}

function guessDateColumn(
  rows: Cell[][],
  headerRow: number,
  headers: string[],
  taken: Set<string>,
): string | null {
  const body = rows.slice(headerRow + 1, headerRow + 41);
  let bestHeader: string | null = null;
  let bestHits = 0;

  headers.forEach((header, col) => {
    if (!header || taken.has(header)) return;
    let hits = 0;
    for (const row of body) {
      const cell = row?.[col];
      if (cell == null || cell === "") continue;
      if (cell instanceof Date || parseDate(cell)) hits++;
    }
    if (hits >= 3 && hits > bestHits) {
      bestHeader = header;
      bestHits = hits;
    }
  });

  return bestHeader;
}

/** User overrides beat the heuristic; an empty string means "explicitly none". */
export function mergeColumns(auto: ColumnMap, user: ColumnMap | undefined): ColumnMap {
  if (!user) return auto;
  const out: ColumnMap = { ...auto };
  for (const [field, header] of Object.entries(user) as [Field, string][]) {
    if (header === "") delete out[field];
    else if (header) out[field] = header;
  }
  return out;
}
