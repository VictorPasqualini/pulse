/** Everything date-shaped lives here: parsing what people type into spreadsheets,
 *  and the two buckets the dashboard groups by (month and week). */

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_SHORT_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Excel's epoch is 1899-12-30 once its leap-year bug is accounted for. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100_000) return null;
  const ms = EXCEL_EPOCH_UTC + Math.round(serial) * 86_400_000;
  return isoFromUTC(new Date(ms));
}

/**
 * Parse the date formats that actually show up in Brazilian spreadsheets:
 * 31/12/2025, 31-12-25, 2025-12-31, 31/dez/2025, and raw Excel serials.
 * Returns an ISO yyyy-mm-dd string, or null when the cell is not a date.
 */
export function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : isoFromUTC(value);
  }

  if (typeof value === "number") return excelSerialToISO(value);

  const raw = String(value).trim();
  if (!raw) return null;

  // Already ISO (possibly with a time component).
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return build(+iso[1], +iso[2], +iso[3]);

  // dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy — day first, as written in pt-BR.
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) return build(expandYear(+dmy[3]), +dmy[2], +dmy[1]);

  // 31/dez/2025 or 31 de dezembro de 2025
  const named = raw.toLowerCase().match(/^(\d{1,2})\s*(?:de\s*)?[/\- ]?\s*([a-zçã]{3,})\.?\s*(?:de\s*)?[/\- ]?\s*(\d{2,4})/);
  if (named) {
    const idx = monthIndexPT(named[2]);
    if (idx >= 0) return build(expandYear(+named[3]), idx + 1, +named[1]);
  }

  // A bare Excel serial that arrived as text.
  if (/^\d+([.,]\d+)?$/.test(raw)) return excelSerialToISO(Number(raw.replace(",", ".")));

  return null;
}

function monthIndexPT(token: string): number {
  const t = token.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const full = MONTHS_PT.findIndex((m) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === t);
  if (full >= 0) return full;
  return MONTHS_SHORT_PT.findIndex((m) => t.startsWith(m));
}

function expandYear(y: number): number {
  if (y >= 1000) return y;
  return y <= 79 ? 2000 + y : 1900 + y;
}

function build(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return isoFromUTC(dt);
}

function isoFromUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ months */

/** yyyy-mm — the grouping key for every monthly aggregate. */
export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthLabel(key: string, style: "short" | "long" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const name = style === "long" ? MONTHS_PT[m - 1] : MONTHS_SHORT_PT[m - 1];
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return style === "long" ? `${cap} de ${y}` : `${cap}/${String(y).slice(2)}`;
}

export function monthShift(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Every month between the two keys, inclusive — gaps included, so a quiet
 *  month shows as a gap in the chart instead of silently collapsing. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let guard = 0; guard < 600 && cur <= to; guard++) {
    out.push(cur);
    cur = monthShift(cur, 1);
  }
  return out;
}

export const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/* ------------------------------------------------------------------- weeks */

/** 1-5: which week of its own month the date falls in, split on calendar weeks
 *  starting Monday. Weekly spending is read against a month, not against ISO
 *  week 34 of the year — that is the number people actually budget with. */
export function weekOfMonth(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Mon = 0
  return Math.floor((d + firstDow - 1) / 7) + 1;
}

/** Inclusive day range of a week-of-month, clamped to the month. */
export function weekBounds(monthKeyValue: string, week: number): { from: number; to: number } {
  const [y, m] = monthKeyValue.split("-").map(Number);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const from = Math.max(1, (week - 1) * 7 + 1 - firstDow);
  const to = Math.min(daysInMonth(monthKeyValue), week * 7 - firstDow);
  return { from, to };
}

export function weekLabel(monthKeyValue: string, week: number): string {
  const { from, to } = weekBounds(monthKeyValue, week);
  return `${pad(from)}–${pad(to)}`;
}

export function weeksInMonth(monthKeyValue: string): number {
  return weekOfMonth(`${monthKeyValue}-${pad(daysInMonth(monthKeyValue))}`);
}

export const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function fullDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad(d)} de ${MONTHS_PT[m - 1]} de ${y}`;
}

export function todayISO(): string {
  return isoFromUTC(new Date());
}

export function relativeFromNow(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "agora";
  if (secs < 5400) {
    const mins = Math.round(secs / 60);
    return `há ${mins} min`;
  }
  const hours = Math.round(secs / 3600);
  if (hours < 36) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}
