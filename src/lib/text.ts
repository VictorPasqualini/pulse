/** Unicode combining diacritical marks, U+0300 to U+036F. */
const COMBINING = /[̀-ͯ]/g;

/** Strip accents so "Descrição" and "descricao" compare equal. */
export function deaccent(value: string): string {
  return value.normalize("NFD").replace(COMBINING, "");
}

/** Lower-case, accent-free, whitespace-collapsed — the form every keyword list
 *  and every user-supplied rule term is compared in. */
export function fold(value: unknown): string {
  return deaccent(String(value ?? ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patterns = new Map<string, RegExp>();

/**
 * A term matches at a word boundary, never in the middle of a word.
 *
 * Plain `includes` is wrong for Portuguese: once accents are stripped, "acao"
 * sits inside "educacao" and "racao", so a book and a bag of dog food would be
 * filed as investments. Short terms (CRI, LCA, B3) must match exactly — they are
 * acronyms and appear inside ordinary words; longer ones may grow a suffix, so
 * "invest" still catches "investimento" and "investir".
 */
function pattern(term: string): RegExp {
  let regex = patterns.get(term);
  if (!regex) {
    const tail = term.length > 4 ? "[a-z]*" : "";
    regex = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}${tail}(?:$|[^a-z0-9])`);
    patterns.set(term, regex);
  }
  return regex;
}

/** True when any term appears in the folded haystack. Terms are folded too, so
 *  a rule typed as "Ações" matches a cell reading "ACOES". */
export function matchesAny(haystack: string, terms: readonly string[]): boolean {
  const hay = fold(haystack);
  if (!hay) return false;
  return terms.some((term) => {
    const t = fold(term);
    return t.length > 0 && pattern(t).test(hay);
  });
}

/**
 * "3/12" out of the two columns a sheet usually keeps apart — `parcela` and
 * `total_parcelas`.
 *
 * A lone "3" is unreadable: three of what? And "1/1" is worse than nothing, since
 * it labels an ordinary purchase as an installment plan — which is why a total of
 * one returns null instead. Sheets that already write the pair in one cell are
 * passed through untouched.
 */
export function installmentLabel(current: string | null, total: string | null): string | null {
  const one = (value: string | null) => (value ?? "").trim();
  const now = one(current);
  const all = one(total);

  if (now.includes("/")) return now;
  if (!all || all === "1") return now && now !== "1" ? now : null;
  if (!now) return `1/${all}`;
  return `${now}/${all}`;
}

/**
 * Acronyms a spreadsheet writes in lowercase because it was typed in a hurry.
 * "Pix" and "Ted" read as words; PIX and TED read as what they are.
 */
const ACRONYMS = new Set([
  "pix", "ted", "doc", "cdb", "cdi", "lci", "lca", "fii", "etf", "ipva", "iptu", "inss", "fgts",
]);

/** Title-case a segment name for display without mangling acronyms the user
 *  typed in caps (CDB, FII, IPVA). */
export function titleize(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      if (ACRONYMS.has(deaccent(word).toLowerCase())) return word.toUpperCase();
      if (word.length <= 1) return word.toUpperCase();
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
