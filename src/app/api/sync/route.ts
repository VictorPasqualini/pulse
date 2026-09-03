import { NextResponse } from "next/server";
import { invalidateConfig } from "@/lib/config";
import { loadDataset } from "@/lib/source";

export const dynamic = "force-dynamic";

/** The Atualizar button. Bypasses both caches and reports what came back. */
export async function POST() {
  invalidateConfig();
  const result = await loadDataset({ force: true });

  if (result.status === "unconfigured") {
    return NextResponse.json({ status: "unconfigured" }, { status: 409 });
  }

  if (result.status === "error") {
    return NextResponse.json(
      { status: "error", message: result.message, hint: result.hint },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "ok",
    transactions: result.dataset.transactions.length,
    issues: result.dataset.issues.length,
    sheet: result.dataset.usedSheet,
    fetchedAt: result.dataset.fetchedAt,
  });
}
