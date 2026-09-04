import { unzipSync } from "fflate";

/**
 * A deliberately small .xlsx reader.
 *
 * The npm `xlsx` package is unmaintained with an unfixed advisory, and Pulse only
 * ever needs to *read* a grid of cells. So: unzip, walk the four parts that matter
 * (workbook, rels, sharedStrings, styles) and scan the sheet XML. No formulas,
 * no styling, no writing.
 */

export type Cell = string | number | boolean | Date | null;

export interface Workbook {
  sheetNames: string[];
  sheet(name?: string): Cell[][];
}

const decoder = new TextDecoder("utf-8");

export function readWorkbook(data: Uint8Array): Workbook {
  const files = unzipSync(data);
  const text = (path: string): string | null => {
    const hit = files[path] ?? files[path.replace(/^\//, "")];
    return hit ? decoder.decode(hit) : null;
  };

  const workbookXml = text("xl/workbook.xml");
  if (!workbookXml) {
    throw new Error("Arquivo .xlsx inválido: xl/workbook.xml não encontrado.");
  }

  const rels = parseRels(text("xl/_rels/workbook.xml.rels") ?? "");
  const shared = parseSharedStrings(text("xl/sharedStrings.xml"));
  const dateStyles = parseDateStyles(text("xl/styles.xml"));

  const entries: { name: string; path: string }[] = [];
  for (const tag of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = parseAttrs(tag[1]);
    const name = decodeEntities(attrs["name"] ?? "");
    const rid = attrs["r:id"] ?? attrs["id"] ?? "";
    const target = rels[rid];
    if (!name || !target) continue;
    entries.push({ name, path: normalizeTarget(target) });
  }

  if (entries.length === 0) throw new Error("Nenhuma aba encontrada na planilha.");

  return {
    sheetNames: entries.map((e) => e.name),
    sheet(name?: string) {
      const entry = (name && entries.find((e) => e.name === name)) || entries[0];
      const xml = text(entry.path);
      if (!xml) throw new Error(`Não foi possível ler a aba "${entry.name}".`);
      return parseSheet(xml, shared, dateStyles);
    },
  };
}

/* ------------------------------------------------------------------- parts */

function parseRels(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = parseAttrs(m[1]);
    if (a["Id"] && a["Target"]) out[a["Id"]] = a["Target"];
  }
  return out;
}

function normalizeTarget(target: string): string {
  const clean = target.replace(/^\/?xl\//, "").replace(/^\//, "");
  return `xl/${clean}`;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  // Each <si> is a single <t> or a set of formatting runs; concatenate the runs
  // and drop <rPh> phonetic hints, which would otherwise duplicate the text.
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const body = si[1].replace(/<rPh[\s\S]*?<\/rPh>/g, "");
    let value = "";
    for (const t of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) value += t[1];
    out.push(decodeEntities(value));
  }
  return out;
}

/** Built-in numFmtIds that Excel renders as a date or a time. */
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/**
 * Which cellXf indexes point at a date format. A numeric cell only means a date
 * when its style says so — otherwise 45000 is just forty-five thousand reais.
 */
function parseDateStyles(xml: string | null): Set<number> {
  const dateStyles = new Set<number>();
  if (!xml) return dateStyles;

  const customDate = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const a = parseAttrs(m[1]);
    const id = Number(a["numFmtId"]);
    const code = decodeEntities(a["formatCode"] ?? "");
    if (!Number.isFinite(id)) continue;
    // Strip quoted literals and colour/condition blocks before sniffing tokens.
    const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
    if (/(y{2,}|d{1,2}|m{3,}|h)/i.test(bare)) customDate.add(id);
  }

  const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!cellXfs) return dateStyles;

  let index = 0;
  for (const xf of cellXfs[1].matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)) {
    const a = parseAttrs(xf[1]);
    const id = Number(a["numFmtId"] ?? "0");
    if (BUILTIN_DATE_FMT.has(id) || customDate.has(id)) dateStyles.add(index);
    index++;
  }
  return dateStyles;
}

/* ------------------------------------------------------------------ sheets */

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function parseSheet(xml: string, shared: string[], dateStyles: Set<number>): Cell[][] {
  const rows: Cell[][] = [];

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = parseAttrs(rowMatch[1]);
    const rowIndex = Number(rowAttrs["r"]) - 1;
    const cells: Cell[] = [];

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = parseAttrs(cellMatch[1]);
      const body = cellMatch[2] ?? "";
      const col = a["r"] ? columnIndex(a["r"]) : cells.length;
      while (cells.length < col) cells.push(null);
      cells[col] = cellValue(a["t"], a["s"], body, shared, dateStyles);
    }

    // Keep every row at its real spreadsheet index so issue messages line up
    // with what the user sees in Excel.
    const at = Number.isFinite(rowIndex) && rowIndex >= 0 ? rowIndex : rows.length;
    while (rows.length < at) rows.push([]);
    rows[at] = cells;
  }

  return rows;
}

function cellValue(
  t: string | undefined,
  s: string | undefined,
  body: string,
  shared: string[],
  dateStyles: Set<number>,
): Cell {
  const raw = firstTag(body, "v");

  switch (t) {
    case "s": {
      const idx = Number(raw);
      return Number.isFinite(idx) ? shared[idx] ?? "" : "";
    }
    case "inlineStr": {
      let value = "";
      for (const tag of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) value += tag[1];
      return decodeEntities(value);
    }
    case "str":
      return raw == null ? "" : decodeEntities(raw);
    case "b":
      return raw === "1";
    case "e":
      return null;
    case "d":
      return raw ? new Date(raw) : null;
    default: {
      if (raw == null || raw === "") return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return decodeEntities(raw);
      const styleIndex = Number(s ?? "0");
      if (dateStyles.has(styleIndex) && n > 0 && n < 100_000) {
        return new Date(EXCEL_EPOCH_UTC + Math.round(n) * 86_400_000);
      }
      return n;
    }
  }
}

function firstTag(body: string, tag: string): string | null {
  const m = body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}

/** "BC12" -> 54. */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) n = n * 26 + (code - 64);
    else if (code >= 97 && code <= 122) n = n * 26 + (code - 96);
    else break;
  }
  return Math.max(0, n - 1);
}

function parseAttrs(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of fragment.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}
