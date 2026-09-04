import type { Transaction } from "@/lib/types";
import { monthKey, monthRange, weekLabel, weekOfMonth, weeksInMonth } from "@/lib/dates";
import { CATEGORICAL, CATEGORICAL_ALL_PAIRS_CAP } from "@/lib/palette";

/* ------------------------------------------------------------------ shapes */

export interface MonthTotals {
  key: string;
  income: number;
  expense: number;
  /** income − expense. Investment movements are deliberately absent. */
  net: number;
  /** net / income, or null when there was no income to save out of. */
  savingsRate: number | null;
  contrib: number;
  withdraw: number;
  /** Signed: a loss is negative. */
  yield: number;
  count: number;
}

export interface Slice {
  name: string;
  amount: number;
  share: number;
  count: number;
  /** Rank in the list, biggest first; -1 marks the folded "Outros" row. */
  slot: number;
}

export interface WeekBucket {
  week: number;
  label: string;
  amount: number;
  count: number;
}

export interface CardBucket {
  card: string;
  amount: number;
  count: number;
  topSegment: string | null;
  slot: number;
}

export interface AssetBucket {
  asset: string;
  contrib: number;
  withdraw: number;
  yield: number;
  /** contrib − withdraw + yield: what the position is worth per the sheet. */
  position: number;
  /** yield / contrib — return on what was put in, not time-weighted. */
  returnOnContrib: number | null;
}

export interface InvestPoint {
  key: string;
  contrib: number;
  withdraw: number;
  yield: number;
  /** Running position at the end of the month. */
  position: number;
}

const MAX_SLOTS = CATEGORICAL.dark.length;

/* ------------------------------------------------------------------ months */

const emptyMonth = (key: string): MonthTotals => ({
  key,
  income: 0,
  expense: 0,
  net: 0,
  savingsRate: null,
  contrib: 0,
  withdraw: 0,
  yield: 0,
  count: 0,
});

function accumulate(target: MonthTotals, tx: Transaction): void {
  target.count++;
  switch (tx.bucket) {
    case "income":
      target.income += tx.amount;
      break;
    case "expense":
      target.expense += tx.amount;
      break;
    case "invest_contrib":
      target.contrib += tx.amount;
      break;
    case "invest_withdraw":
      target.withdraw += tx.amount;
      break;
    case "invest_yield":
      target.yield += tx.flow === "in" ? tx.amount : -tx.amount;
      break;
  }
}

function seal(m: MonthTotals): MonthTotals {
  m.net = m.income - m.expense;
  m.savingsRate = m.income > 0 ? m.net / m.income : null;
  return m;
}

/** One entry per calendar month between the first and last transaction, so a
 *  month with nothing in it renders as a gap instead of vanishing. */
export function monthlySeries(transactions: Transaction[]): MonthTotals[] {
  if (transactions.length === 0) return [];

  const byKey = new Map<string, MonthTotals>();
  for (const tx of transactions) {
    const key = monthKey(tx.date);
    let entry = byKey.get(key);
    if (!entry) {
      entry = emptyMonth(key);
      byKey.set(key, entry);
    }
    accumulate(entry, tx);
  }

  const keys = [...byKey.keys()].sort();
  return monthRange(keys[0], keys[keys.length - 1]).map((key) =>
    seal(byKey.get(key) ?? emptyMonth(key)),
  );
}

export function totalsFor(transactions: Transaction[], key: string): MonthTotals {
  const totals = emptyMonth(key);
  for (const tx of transactions) {
    if (monthKey(tx.date) === key) accumulate(totals, tx);
  }
  return seal(totals);
}

export function availableMonths(transactions: Transaction[]): string[] {
  const set = new Set(transactions.map((tx) => monthKey(tx.date)));
  return [...set].sort().reverse();
}

/**
 * Which month a screen opens on.
 *
 * Not the newest month in the data: a ledger that records installments books them
 * on the dates they will be paid, so a purchase split into 12x plants rows up to a
 * year ahead and the last month present is a nearly empty future one. Opening there
 * shows a dashboard with one transaction in it. The current month is the answer when
 * it has rows, otherwise the newest month that has already happened.
 */
export function defaultMonth(months: string[], today = new Date().toISOString()): string {
  const now = monthKey(today);
  return months.find((key) => key <= now) ?? months[0] ?? "";
}

export const inMonth = (transactions: Transaction[], key: string) =>
  transactions.filter((tx) => monthKey(tx.date) === key);

/* ---------------------------------------------------------------- segments */

/**
 * Segment shares, biggest first, with the tail folded into "Outros".
 *
 * The list is capped rather than unbounded: past eight rows a ranking stops being
 * read and starts being scrolled, and the long tail says more as one row than as
 * twenty. A chart that colours each slice (donut, treemap) must pass the tighter
 * all-pairs cap, since its marks touch and have to survive the CVD check.
 */
export function segmentSlices(
  transactions: Transaction[],
  predicate: (tx: Transaction) => boolean,
  limit: number = MAX_SLOTS,
): Slice[] {
  const byName = new Map<string, { amount: number; count: number }>();
  let total = 0;

  for (const tx of transactions) {
    if (!predicate(tx)) continue;
    const entry = byName.get(tx.segment) ?? { amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count++;
    byName.set(tx.segment, entry);
    total += tx.amount;
  }

  const ranked = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const head = ranked.slice(0, limit);
  const tail = ranked.slice(limit);

  const slices: Slice[] = head.map((entry, i) => ({
    name: entry.name,
    amount: entry.amount,
    share: total > 0 ? entry.amount / total : 0,
    count: entry.count,
    slot: i,
  }));

  if (tail.length) {
    const amount = tail.reduce((sum, e) => sum + e.amount, 0);
    slices.push({
      name: `Outros (${tail.length})`,
      amount,
      share: total > 0 ? amount / total : 0,
      count: tail.reduce((sum, e) => sum + e.count, 0),
      slot: -1,
    });
  }

  return slices;
}

export const DONUT_SLOT_CAP = CATEGORICAL_ALL_PAIRS_CAP;

/* ------------------------------------------------------------------- weeks */

/** Spending per calendar week of the given month, every week present. */
export function weeklySpend(transactions: Transaction[], key: string): WeekBucket[] {
  const weeks = weeksInMonth(key);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    label: weekLabel(key, i + 1),
    amount: 0,
    count: 0,
  }));

  for (const tx of transactions) {
    if (tx.bucket !== "expense" || monthKey(tx.date) !== key) continue;
    const bucket = buckets[weekOfMonth(tx.date) - 1];
    if (!bucket) continue;
    bucket.amount += tx.amount;
    bucket.count++;
  }

  return buckets;
}

/* --------------------------------------------------------- payment methods */

export interface MethodBucket {
  method: string;
  amount: number;
  count: number;
  /** Slice of the month's saídas, so the row reads without doing the division. */
  share: number;
}

/**
 * Saídas by how they were paid — the `tipo_transacao` column most Brazilian
 * ledgers keep: crédito, débito, pix, ted.
 *
 * This is the split that actually exists in the data. Grouping by card name reads
 * better on paper but collapses to a single row on any sheet without a card
 * column: with nothing to name the card, every credit row is just "crédito", and
 * a list of one is not a breakdown. The payment type separates a card purchase
 * from a transfer, which is the distinction worth seeing on the dashboard.
 */
export function methodBuckets(transactions: Transaction[]): MethodBucket[] {
  const byMethod = new Map<string, { amount: number; count: number }>();
  let total = 0;

  for (const tx of transactions) {
    if (tx.bucket !== "expense") continue;
    const key = tx.method.trim() || tx.card?.trim() || NO_METHOD;
    const entry = byMethod.get(key) ?? { amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count++;
    byMethod.set(key, entry);
    total += tx.amount;
  }

  return [...byMethod.entries()]
    .map(([method, entry]) => ({
      method,
      amount: entry.amount,
      count: entry.count,
      share: total > 0 ? entry.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

const NO_METHOD = "Sem forma de pagamento";

/* ------------------------------------------------------------------- cards */

export function cardBuckets(transactions: Transaction[]): CardBucket[] {
  const byCard = new Map<string, { amount: number; count: number; segments: Map<string, number> }>();

  for (const tx of transactions) {
    if (tx.bucket !== "expense" || !tx.card) continue;
    const key = tx.card;
    const entry = byCard.get(key) ?? { amount: 0, count: 0, segments: new Map() };
    entry.amount += tx.amount;
    entry.count++;
    entry.segments.set(tx.segment, (entry.segments.get(tx.segment) ?? 0) + tx.amount);
    byCard.set(key, entry);
  }

  return [...byCard.entries()]
    .map(([card, entry]) => {
      const top = [...entry.segments.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        card,
        amount: entry.amount,
        count: entry.count,
        topSegment: top ? top[0] : null,
        slot: 0,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .map((bucket, i) => ({ ...bucket, slot: i < MAX_SLOTS ? i : -1 }));
}

/* ------------------------------------------------------------- investments */

export interface InvestmentSummary {
  contrib: number;
  withdraw: number;
  yield: number;
  /** contrib − withdraw + yield. */
  position: number;
  returnOnContrib: number | null;
  assets: AssetBucket[];
  /** What the per-asset rows are keyed by — the screen has to say which. */
  groupedBy: "asset" | "description";
  series: InvestPoint[];
  /** The month that earned the most; null before anything has yielded. */
  bestMonth: InvestPoint | null;
  /** The month that lost the most, and null when no month lost anything —
   *  "pior mês" naming a smaller gain would read as a loss that never happened. */
  worstMonth: InvestPoint | null;
}

/** Rows in the per-asset table before the tail is folded into "Outros". */
const MAX_ASSET_ROWS = 12;

export function investmentSummary(transactions: Transaction[]): InvestmentSummary {
  const invest = transactions.filter((tx) => tx.bucket.startsWith("invest_"));

  let contrib = 0;
  let withdraw = 0;
  let yieldTotal = 0;

  const byAsset = new Map<
    string,
    { contrib: number; withdraw: number; yield: number; lastWithdraw: string }
  >();
  const byMonth = new Map<string, { contrib: number; withdraw: number; yield: number }>();

  /**
   * What one row of this table is.
   *
   * An asset column is the answer whenever the sheet has one. When it does not, the
   * description is: a ledger without an asset column writes the asset's name there
   * ("CDB PicPay 200% CDI", "proventos FII"), so grouping by it produces the table
   * the user expects. The segment is the last resort and almost never useful here —
   * every investment row tends to carry the same one, which collapses the whole
   * table into a single line that only repeats the totals above it.
   */
  const grouped = invest.some((tx) => (tx.asset ?? "").trim() !== "") ? "asset" : "description";

  for (const tx of invest) {
    const assetKey =
      (grouped === "asset" ? tx.asset?.trim() : "") || tx.description.trim() || tx.segment;
    const asset = byAsset.get(assetKey) ?? { contrib: 0, withdraw: 0, yield: 0, lastWithdraw: "" };
    const month = byMonth.get(monthKey(tx.date)) ?? { contrib: 0, withdraw: 0, yield: 0 };

    if (tx.bucket === "invest_contrib") {
      contrib += tx.amount;
      asset.contrib += tx.amount;
      month.contrib += tx.amount;
    } else if (tx.bucket === "invest_withdraw") {
      withdraw += tx.amount;
      asset.withdraw += tx.amount;
      month.withdraw += tx.amount;
      const key = monthKey(tx.date);
      if (key > asset.lastWithdraw) asset.lastWithdraw = key;
    } else {
      const signed = tx.flow === "in" ? tx.amount : -tx.amount;
      yieldTotal += signed;
      asset.yield += signed;
      month.yield += signed;
    }

    byAsset.set(assetKey, asset);
    byMonth.set(monthKey(tx.date), month);
  }

  /**
   * The gain a redemption carries but does not name.
   *
   * Most ledgers do not split a resgate into principal and profit: a CDB that took
   * R$ 143.000 and paid back R$ 152.862,66 is written as one contribution and one
   * redemption, and nothing in the row says that R$ 9.862,66 of it was interest.
   * Read literally, that asset ends at a *negative* position — impossible — and the
   * portfolio reports a return near zero while the sheet plainly shows it made
   * money. So for an asset whose redemptions exceed what went into it, the excess is
   * booked as a realised gain, in the month of its last redemption.
   *
   * Two guards keep this from inventing profit. It needs a contribution inside the
   * data, so an asset bought before the sheet begins and sold inside it is left
   * alone rather than counted as pure gain; and any yield the sheet *did* record for
   * the asset is subtracted first, so an explicit provento is never double-counted.
   */
  for (const v of byAsset.values()) {
    const unnamedGain = v.withdraw - v.contrib - Math.max(0, v.yield);
    if (v.contrib <= 0 || unnamedGain <= 0 || !v.lastWithdraw) continue;

    v.yield += unnamedGain;
    yieldTotal += unnamedGain;
    const month = byMonth.get(v.lastWithdraw);
    if (month) month.yield += unnamedGain;
  }

  const ranked = [...byAsset.entries()]
    .map(([asset, v]) => ({
      asset,
      contrib: v.contrib,
      withdraw: v.withdraw,
      yield: v.yield,
      position: v.contrib - v.withdraw + v.yield,
      returnOnContrib: v.contrib > 0 ? v.yield / v.contrib : null,
    }))
    // Ranked by how much of the portfolio the asset accounts for, which is its
    // position *or* what was put into it — sorting on position alone sinks a closed
    // asset to the bottom, and a CDB that took R$ 143.000 and paid back is not the
    // least interesting line in the table just because nothing is left in it.
    .sort((a, b) => Math.max(b.position, b.contrib) - Math.max(a.position, a.contrib));

  // A long tail of one-off lines is noise in a table meant to be scanned; folding it
  // keeps the totals honest without making the reader scroll past forty rows.
  const assets: AssetBucket[] = ranked.slice(0, MAX_ASSET_ROWS);
  const tail = ranked.slice(MAX_ASSET_ROWS);
  if (tail.length) {
    const folded = tail.reduce(
      (sum, b) => ({
        contrib: sum.contrib + b.contrib,
        withdraw: sum.withdraw + b.withdraw,
        yield: sum.yield + b.yield,
        position: sum.position + b.position,
      }),
      { contrib: 0, withdraw: 0, yield: 0, position: 0 },
    );
    assets.push({
      asset: `Outros (${tail.length})`,
      ...folded,
      returnOnContrib: folded.contrib > 0 ? folded.yield / folded.contrib : null,
    });
  }

  const keys = [...byMonth.keys()].sort();
  const series: InvestPoint[] = [];
  if (keys.length) {
    let running = 0;
    for (const key of monthRange(keys[0], keys[keys.length - 1])) {
      const m = byMonth.get(key) ?? { contrib: 0, withdraw: 0, yield: 0 };
      running += m.contrib - m.withdraw + m.yield;
      series.push({ key, contrib: m.contrib, withdraw: m.withdraw, yield: m.yield, position: running });
    }
  }

  const gains = series.filter((p) => p.yield > 0);
  const losses = series.filter((p) => p.yield < 0);
  const bestMonth = gains.length ? gains.reduce((best, p) => (p.yield > best.yield ? p : best)) : null;
  // Only an actual loss can be the "pior mês". With every month in the black the
  // pair degenerates into best and second-best, and a card reading "Pior mês
  // +R$ 2,85" tells the reader a loss happened when none did.
  const worstMonth = losses.length
    ? losses.reduce((worst, p) => (p.yield < worst.yield ? p : worst))
    : null;

  return {
    contrib,
    withdraw,
    yield: yieldTotal,
    position: contrib - withdraw + yieldTotal,
    returnOnContrib: contrib > 0 ? yieldTotal / contrib : null,
    assets,
    groupedBy: grouped,
    series,
    bestMonth,
    worstMonth,
  };
}

/* ------------------------------------------------------------------- misc */

export function biggestExpenses(transactions: Transaction[], take = 5): Transaction[] {
  return transactions
    .filter((tx) => tx.bucket === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, take);
}

/** Average of the months before `key` that actually have data — the baseline the
 *  dashboard compares the selected month against. */
export function trailingAverage(
  series: MonthTotals[],
  key: string,
  pick: (m: MonthTotals) => number,
  months = 3,
): number | null {
  const index = series.findIndex((m) => m.key === key);
  if (index <= 0) return null;
  const window = series.slice(Math.max(0, index - months), index).filter((m) => m.count > 0);
  if (window.length === 0) return null;
  return window.reduce((sum, m) => sum + pick(m), 0) / window.length;
}
