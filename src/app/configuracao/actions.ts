"use server";

import { revalidatePath } from "next/cache";
import { linesToList, readConfig, writeConfig } from "@/lib/config";
import { invalidateDataset } from "@/lib/source";
import type { ColumnMap, Field } from "@/lib/types";
import { FIELD_LABEL } from "@/lib/types";

/**
 * Every save does the same three things: persist, drop the dataset cache, and
 * revalidate the screens that read it. The cache is in-process, so forgetting the
 * middle step would leave the dashboard showing the old mapping for a minute.
 */
async function commit(patch: Parameters<typeof writeConfig>[0]) {
  await writeConfig(patch);
  invalidateDataset();
  for (const path of ["/", "/investimentos", "/cartoes", "/lancamentos", "/configuracao"]) {
    revalidatePath(path);
  }
}

export async function saveSource(formData: FormData): Promise<void> {
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const sheetName = String(formData.get("sheetName") ?? "").trim();
  const headerRowRaw = String(formData.get("headerRow") ?? "").trim();
  const headerRow = headerRowRaw === "" ? null : Math.max(0, Number(headerRowRaw) - 1);

  await commit({
    sourceUrl,
    sheetName,
    headerRow: Number.isFinite(headerRow as number) ? headerRow : null,
  });
}

export async function saveColumns(formData: FormData): Promise<void> {
  const columns: ColumnMap = {};
  for (const field of Object.keys(FIELD_LABEL) as Field[]) {
    const value = formData.get(`col.${field}`);
    if (typeof value === "string") columns[field] = value;
  }
  await commit({ columns });
}

export async function resetColumns(): Promise<void> {
  await commit({ columns: {} });
}

export async function saveRules(formData: FormData): Promise<void> {
  const current = await readConfig();
  const pick = (name: keyof typeof current.rules) => {
    const raw = formData.get(name);
    return typeof raw === "string" ? linesToList(raw) : current.rules[name];
  };

  await commit({
    rules: {
      investmentTerms: pick("investmentTerms"),
      yieldTerms: pick("yieldTerms"),
      withdrawTerms: pick("withdrawTerms"),
      creditTerms: pick("creditTerms"),
      ignoredSegments: pick("ignoredSegments"),
    },
  });
}
