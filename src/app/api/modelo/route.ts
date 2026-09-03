/**
 * The model spreadsheet, as CSV.
 *
 * CSV on purpose: Excel and Google Sheets both open it, it is one file with no
 * binary format to maintain, and the point is only to show the shape Pulse reads
 * best — the app works with the columns you already have. The example rows exist
 * to demonstrate the one rule that is not obvious: an aporte is an outflow that is
 * not a gasto, and a rendimento is an inflow that is not a receita.
 */

const HEADERS = [
  "Data",
  "Descrição",
  "Tipo",
  "Valor",
  "Segmento",
  "Conta",
  "Forma de pagamento",
  "Cartão",
  "Ativo",
  "Parcela",
  "Observação",
];

const ROWS: string[][] = [
  ["05/01/2026", "Salário", "Entrada", "7500,00", "Salário", "Conta corrente", "Transferência", "", "", "", ""],
  ["06/01/2026", "Mercado do mês", "Saída", "820,45", "Mercado", "Conta corrente", "Crédito", "Nubank", "", "", ""],
  ["06/01/2026", "Aluguel", "Saída", "2100,00", "Moradia", "Conta corrente", "Débito", "", "", "", ""],
  ["10/01/2026", "Aporte Tesouro Selic", "Saída", "1200,00", "Investimento", "Corretora", "Transferência", "", "Tesouro Selic", "", "Não é gasto"],
  ["12/01/2026", "Cinema", "Saída", "68,00", "Lazer", "Conta corrente", "Crédito", "Nubank", "", "1/1", ""],
  ["15/01/2026", "Notebook", "Saída", "450,00", "Eletrônicos", "Conta corrente", "Crédito", "Inter", "", "3/10", ""],
  ["31/01/2026", "Rendimento Tesouro Selic", "Entrada", "14,30", "Investimento", "Corretora", "", "", "Tesouro Selic", "", "Não é receita"],
  ["31/01/2026", "Rendimento FII", "Entrada", "-22,10", "Investimento", "Corretora", "", "", "FII", "", "Perda no mês"],
];

function escape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function GET(): Response {
  // Semicolon-delimited with a BOM: what pt-BR Excel opens without an import
  // wizard. Pulse itself sniffs the delimiter, so this is purely for the user.
  const csv = [HEADERS, ...ROWS].map((row) => row.map(escape).join(";")).join("\r\n");

  return new Response("﻿" + csv + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pulse-modelo.csv"',
      "Cache-Control": "no-store",
    },
  });
}
