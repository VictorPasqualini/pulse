/**
 * The model spreadsheet, as CSV.
 *
 * CSV on purpose: Excel and Google Sheets both open it, it is one file with no
 * binary format to maintain, and the point is only to show the shape Pulse reads
 * best — the app works with the columns you already have. The example rows exist
 * to demonstrate the one rule that is not obvious: an aporte is an outflow that is
 * not a gasto, and a rendimento is an inflow that is not a receita.
 *
 * The header names and their order are the snake_case vocabulary of a real ledger
 * rather than a set invented here, so the model and the sheets people already keep
 * name the same things the same way. `descricao` through `data_pagamento` are that
 * ledger's columns; `conta`, `cartao`, `ativo` and `observacao` are appended because
 * Pulse reads them when they exist. Columns that only restate another one —
 * `parcelado` (true exactly when total_parcelas > 1) and month/week formula
 * columns (Pulse derives both from the date) — are left out: a column the app
 * ignores in a file called "modelo" reads like a column it needs.
 */

const HEADERS = [
  "descricao",
  "seguimento",
  "parcela",
  "total_parcelas",
  "tipo_transacao",
  "valor",
  "tipo",
  "data_pagamento",
  "conta",
  "cartao",
  "ativo",
  "observacao",
];

const ROWS: string[][] = [
  ["Salário", "Salário", "", "", "ted", "7500,00", "Entrada", "05/01/2026", "Conta corrente", "", "", ""],
  ["Mercado do mês", "Mercado", "", "", "credito", "820,45", "Saída", "06/01/2026", "Conta corrente", "Nubank", "", ""],
  ["Aluguel", "Moradia", "", "", "debito", "2100,00", "Saída", "06/01/2026", "Conta corrente", "", "", ""],
  ["Aporte Tesouro Selic", "Investimento", "", "", "ted", "1200,00", "Saída", "10/01/2026", "Corretora", "", "Tesouro Selic", "Não é gasto"],
  ["Cinema", "Lazer", "", "", "credito", "68,00", "Saída", "12/01/2026", "Conta corrente", "Nubank", "", ""],
  ["Notebook", "Eletrônicos", "3", "10", "credito", "450,00", "Saída", "15/01/2026", "Conta corrente", "Inter", "", "Parcela 3 de 10"],
  ["Rendimento Tesouro Selic", "Investimento", "", "", "pix", "14,30", "Entrada", "31/01/2026", "Corretora", "", "Tesouro Selic", "Não é receita"],
  ["Rendimento FII", "Investimento", "", "", "pix", "-22,10", "Entrada", "31/01/2026", "Corretora", "", "FII", "Perda no mês"],
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
