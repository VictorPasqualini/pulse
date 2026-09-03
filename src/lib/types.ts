/** How the row was recorded in the spreadsheet. */
export type Flow = "in" | "out";

/**
 * What the row *means* once classified.
 *
 * The distinction that drives the whole app: an aporte leaves the account (flow
 * "out") but is not spending, and a rendimento arrives (flow "in") but is not
 * income. Only `income` and `expense` feed the cash-flow numbers; the three
 * `invest_*` buckets feed the investment screen.
 */
export type Bucket =
  | "income"
  | "expense"
  | "invest_contrib"
  | "invest_withdraw"
  | "invest_yield";

export const BUCKET_LABEL: Record<Bucket, string> = {
  income: "Entrada",
  expense: "Saída",
  invest_contrib: "Aporte",
  invest_withdraw: "Resgate",
  invest_yield: "Rendimento",
};

export interface Transaction {
  id: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  description: string;
  /** Always a positive magnitude — direction lives in `flow`. */
  amount: number;
  flow: Flow;
  bucket: Bucket;
  segment: string;
  account: string;
  method: string;
  card: string | null;
  asset: string | null;
  installment: string | null;
  note: string;
  /** Origin, so any number on screen can be traced back to a spreadsheet row. */
  sheet: string;
  row: number;
}

/** The canonical fields Pulse understands. Everything else in the sheet is ignored. */
export type Field =
  | "date"
  | "description"
  | "amount"
  | "amountIn"
  | "amountOut"
  | "flow"
  | "segment"
  | "account"
  | "method"
  | "card"
  | "asset"
  | "installment"
  | "note";

export const FIELD_LABEL: Record<Field, string> = {
  date: "Data",
  description: "Descrição",
  amount: "Valor",
  amountIn: "Valor (entrada)",
  amountOut: "Valor (saída)",
  flow: "Tipo (entrada/saída)",
  segment: "Segmento",
  account: "Conta",
  method: "Forma de pagamento",
  card: "Cartão",
  asset: "Ativo / classe",
  installment: "Parcela",
  note: "Observação",
};

export const FIELD_HINT: Partial<Record<Field, string>> = {
  amount: "Uma coluna só, com sinal ou com a coluna de tipo ao lado.",
  amountIn: "Use quando entradas e saídas ficam em colunas separadas.",
  amountOut: "Use quando entradas e saídas ficam em colunas separadas.",
  flow: "Aceita entrada/saída, receita/despesa, crédito/débito, +/-.",
  segment: "O agrupamento do dashboard: mercado, moradia, lazer…",
  asset: "Só para investimentos: CDB, Tesouro, ações, FII…",
};

/** Which header in the sheet feeds each canonical field. */
export type ColumnMap = Partial<Record<Field, string>>;

export interface SheetMeta {
  name: string;
  headers: string[];
  rowCount: number;
}

export interface Rules {
  /** Segment/description terms that mark a row as an investment movement. */
  investmentTerms: string[];
  /** Terms that mark an investment row as a yield rather than a principal move. */
  yieldTerms: string[];
  /** Terms that mark an inflow as a redemption of principal. */
  withdrawTerms: string[];
  /** Payment-method terms that mean "credit card". */
  creditTerms: string[];
  /** Segments to hide from the expense breakdown (internal transfers, etc). */
  ignoredSegments: string[];
}

export interface PulseConfig {
  /** OneDrive share link, SharePoint link, or any direct URL to .xlsx/.csv. */
  sourceUrl: string;
  /** Empty means "first sheet". */
  sheetName: string;
  /** Header row index, 0-based, in case the sheet has a title above the table. */
  headerRow: number | null;
  columns: ColumnMap;
  rules: Rules;
  updatedAt: string | null;
}

export interface ParseIssue {
  sheet: string;
  row: number;
  reason: string;
}

export interface Dataset {
  transactions: Transaction[];
  sheets: SheetMeta[];
  usedSheet: string;
  /** The mapping actually applied — auto-detected unless the user pinned one. */
  columns: ColumnMap;
  autoMapped: boolean;
  issues: ParseIssue[];
  fetchedAt: string;
  sourceLabel: string;
}
