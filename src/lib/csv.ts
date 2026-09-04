import type { Cell } from "@/lib/xlsx/reader";

/**
 * RFC-4180 CSV with two concessions to reality: the delimiter is sniffed (pt-BR
 * Excel writes semicolons) and a leading BOM is dropped.
 */
export function parseCSV(text: string): Cell[][] {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = sniffDelimiter(body);

  const rows: Cell[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row.map(coerce));
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row.map(coerce));
  }

  return rows;
}

function sniffDelimiter(text: string): string {
  const head = text.slice(0, 4000);
  const counts = [";", ",", "\t", "|"].map((d) => [d, head.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

/** Cells stay text: numeric and date coercion happens in normalize.ts, where the
 *  column's role is known. Empty stays null so blank rows stay blank. */
function coerce(value: string): Cell {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
