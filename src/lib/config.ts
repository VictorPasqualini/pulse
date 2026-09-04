import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ColumnMap, PulseConfig, Rules } from "@/lib/types";
import { DEFAULT_RULES } from "@/lib/classify";

/**
 * Where Pulse keeps its own state.
 *
 * There is no database on purpose: the spreadsheet is the source of truth, so the
 * only thing to persist is *how to read it* — the link, the sheet, the column
 * mapping and the classification rules. That fits in one gitignored JSON file,
 * which also makes it trivial to back up or hand-edit.
 */

const DIR = path.join(process.cwd(), ".pulse");
const FILE = path.join(DIR, "config.json");

export const DEFAULT_CONFIG: PulseConfig = {
  sourceUrl: "",
  sheetName: "",
  headerRow: null,
  columns: {},
  rules: DEFAULT_RULES,
  updatedAt: null,
};

let cached: PulseConfig | null = null;

export async function readConfig(): Promise<PulseConfig> {
  if (cached) return cached;

  const fromEnv = process.env.PULSE_SOURCE_URL?.trim();

  try {
    const raw = await readFile(FILE, "utf8");
    cached = reconcile(JSON.parse(raw) as Partial<PulseConfig>, fromEnv);
  } catch {
    cached = reconcile({}, fromEnv);
  }

  return cached;
}

export async function writeConfig(patch: Partial<PulseConfig>): Promise<PulseConfig> {
  const current = await readConfig();
  const next: PulseConfig = {
    ...current,
    ...patch,
    columns: patch.columns ? sanitizeColumns(patch.columns) : current.columns,
    rules: patch.rules ? sanitizeRules(patch.rules) : current.rules,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify({ ...next, rules: pruneRules(next.rules) }, null, 2) + "\n", "utf8");
  cached = next;
  return next;
}

/**
 * Only the term lists the user actually changed get written to disk.
 *
 * Saving the whole rule set would freeze it: every list on disk wins over
 * `DEFAULT_RULES`, so a config written today would keep the vocabulary of today
 * forever, and a term added to the defaults in a later version would silently never
 * reach anyone who had ever pressed Salvar — including on the source form, which
 * has nothing to do with rules. Omitting a list means "follow the defaults"; keeping
 * one means "the user chose this", which is exactly the intent worth persisting.
 */
function pruneRules(rules: Rules): Partial<Rules> {
  const out: Partial<Rules> = {};
  for (const key of Object.keys(DEFAULT_RULES) as (keyof Rules)[]) {
    const list = rules[key];
    const base = DEFAULT_RULES[key];
    if (list.length !== base.length || list.some((term, i) => term !== base[i])) out[key] = list;
  }
  return out;
}

/** Drop the in-process cache — used by the config form after a save. */
export function invalidateConfig(): void {
  cached = null;
}

function reconcile(stored: Partial<PulseConfig>, envSourceUrl?: string): PulseConfig {
  return {
    // An env var is handy for containers, but a link saved in the UI wins: it is
    // the more recent, more deliberate choice.
    sourceUrl: (stored.sourceUrl || envSourceUrl || "").trim(),
    sheetName: stored.sheetName ?? "",
    headerRow:
      typeof stored.headerRow === "number" && stored.headerRow >= 0 ? stored.headerRow : null,
    columns: sanitizeColumns(stored.columns ?? {}),
    // Each missing list falls back to its default; see pruneRules.
    rules: sanitizeRules(stored.rules ?? {}),
    updatedAt: stored.updatedAt ?? null,
  };
}

function sanitizeColumns(columns: ColumnMap): ColumnMap {
  const out: ColumnMap = {};
  for (const [field, header] of Object.entries(columns)) {
    if (typeof header === "string") out[field as keyof ColumnMap] = header.trim();
  }
  return out;
}

function sanitizeRules(rules: Partial<Rules>): Rules {
  const list = (value: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(value)) return fallback;
    const cleaned = value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0)
      .slice(0, 200);
    return [...new Set(cleaned)];
  };

  return {
    investmentTerms: list(rules.investmentTerms, DEFAULT_RULES.investmentTerms),
    yieldTerms: list(rules.yieldTerms, DEFAULT_RULES.yieldTerms),
    withdrawTerms: list(rules.withdrawTerms, DEFAULT_RULES.withdrawTerms),
    creditTerms: list(rules.creditTerms, DEFAULT_RULES.creditTerms),
    ignoredSegments: list(rules.ignoredSegments, DEFAULT_RULES.ignoredSegments),
  };
}

/** Terms are edited as one-per-line textareas. */
export const linesToList = (value: string): string[] =>
  value
    .split(/[\n,;]/)
    .map((v) => v.trim())
    .filter(Boolean);

export const listToLines = (value: readonly string[]): string => value.join("\n");
