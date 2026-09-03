import type { Bucket, Flow, Rules } from "@/lib/types";
import { matchesAny } from "@/lib/text";

/**
 * The rule that shapes every number in Pulse.
 *
 * An aporte leaves the account, so a spreadsheet records it as a saída — but it is
 * not spending, it is a transfer between two things you own. A rendimento arrives,
 * so the sheet records it as an entrada — but it is not income you can spend twice.
 * Both are therefore pulled out of the cash-flow buckets and into the investment
 * ones. Getting this wrong inflates your expenses and your income at the same
 * time and makes the savings rate meaningless.
 */

export const DEFAULT_RULES: Rules = {
  investmentTerms: [
    "investimento", "investimentos", "invest", "aporte", "aportes", "aplicacao", "aplicacoes",
    "tesouro", "selic", "ipca", "cdb", "lci", "lca", "cri", "cra", "debenture",
    "fundo", "fundos", "etf", "fii", "acoes", "acao", "bolsa", "b3", "renda fixa",
    "renda variavel", "poupanca", "previdencia", "pgbl", "vgbl",
    "cripto", "bitcoin", "btc", "ethereum", "corretora", "carteira de investimento",
    "resgate", "rendimento", "rendimentos", "dividendo", "dividendos", "jcp", "proventos",
  ],
  yieldTerms: [
    "rendimento", "rendimentos", "juros", "dividendo", "dividendos", "jcp", "proventos",
    "lucro", "prejuizo", "perda", "ganho de capital", "valorizacao", "desvalorizacao",
    "marcacao a mercado", "yield", "cupom", "amortizacao", "variacao",
  ],
  withdrawTerms: ["resgate", "resgates", "retirada", "saque", "venda", "liquidacao", "vencimento"],
  creditTerms: ["credito", "cartao", "fatura", "card", "parcelado", "parcelamento"],
  ignoredSegments: ["transferencia", "transferencia entre contas", "saldo inicial", "ajuste"],
};

export interface ClassifyInput {
  flow: Flow;
  segment: string;
  description: string;
  asset: string | null;
  method: string;
  account: string;
}

export function classify(input: ClassifyInput, rules: Rules): Bucket {
  const haystack = [input.segment, input.description, input.asset ?? "", input.method, input.account]
    .filter(Boolean)
    .join(" · ");

  // An explicit asset column is the strongest possible signal: nobody fills in
  // "Tesouro IPCA 2029" next to a grocery run.
  const isInvestment =
    (input.asset != null && input.asset.trim() !== "") ||
    matchesAny(haystack, rules.investmentTerms);

  if (!isInvestment) return input.flow === "in" ? "income" : "expense";

  if (matchesAny(haystack, rules.yieldTerms)) return "invest_yield";
  if (input.flow === "out") return "invest_contrib";
  return matchesAny(haystack, rules.withdrawTerms) ? "invest_withdraw" : "invest_yield";
}

/** Signed contribution of a row to a bucket's running total. */
export function signedAmount(bucket: Bucket, flow: Flow, amount: number): number {
  // Only yields are two-directional: a loss is a negative yield, not an expense.
  if (bucket === "invest_yield") return flow === "in" ? amount : -amount;
  return amount;
}

export function isCashFlow(bucket: Bucket): boolean {
  return bucket === "income" || bucket === "expense";
}

export function isInvestment(bucket: Bucket): boolean {
  return !isCashFlow(bucket);
}

/** True when the row was paid with a credit card, by column or by wording. */
export function looksLikeCredit(
  card: string | null,
  method: string,
  description: string,
  rules: Rules,
): boolean {
  if (card && card.trim() !== "") return true;
  return matchesAny([method, description].join(" · "), rules.creditTerms);
}
