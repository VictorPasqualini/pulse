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
  // A term earns its place only if it means "investment" and nothing else. "Bolsa"
  // fails that test — in Portuguese it is a handbag far more often than it is the
  // stock exchange, and a gift-segment purse was being counted as an aporte — so the
  // list carries the unambiguous "bolsa de valores" instead. Same reasoning keeps
  // "renda" out and "renda fixa" in.
  investmentTerms: [
    "investimento", "investimentos", "invest", "aporte", "aportes", "aplicacao", "aplicacoes",
    "tesouro", "selic", "ipca", "cdb", "lci", "lca", "cri", "cra", "debenture",
    "fundo", "fundos", "etf", "fii", "acoes", "acao", "bolsa de valores", "b3", "renda fixa",
    "renda variavel", "poupanca", "previdencia", "pgbl", "vgbl",
    "cripto", "bitcoin", "btc", "ethereum", "corretora", "carteira de investimento",
    "resgate", "rendimento", "rendimentos", "dividendo", "dividendos", "jcp", "proventos",
  ],
  yieldTerms: [
    "rendimento", "rendimentos", "juros", "dividendo", "dividendos", "jcp", "proventos",
    "lucro", "prejuizo", "perda", "ganho de capital", "valorizacao", "desvalorizacao",
    "marcacao a mercado", "yield", "cupom", "amortizacao", "variacao", "cashback",
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

  // Money leaving the account for an asset is always a contribution.
  if (input.flow === "out") return "invest_contrib";

  /**
   * Money coming back is a withdrawal unless it says it is a gain.
   *
   * The two are told apart by vocabulary, and the vocabulary is lopsided: a gain
   * announces itself ("proventos", "dividendo", "rendimento", "cashback"), while a
   * redemption is usually written as nothing more than the asset's own name — the
   * same line that recorded the contribution, pointing the other way. Defaulting
   * such a row to a gain is the expensive mistake: a CDB that took R$ 143.000 and
   * returned R$ 152.862 would be booked as R$ 152.862 of profit instead of R$ 9.862,
   * and every return figure on the investments screen would be fiction. Defaulting
   * to a withdrawal only understates the gain, which the numbers themselves reveal.
   *
   * A withdrawal term wins over a yield term, so "resgate do rendimento" is read as
   * the resgate it is.
   */
  if (matchesAny(haystack, rules.withdrawTerms)) return "invest_withdraw";
  return matchesAny(haystack, rules.yieldTerms) ? "invest_yield" : "invest_withdraw";
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
