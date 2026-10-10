import { parse } from "csv-parse/browser/esm/sync";
import { stringify } from "csv-stringify/browser/esm/sync";
import type { Bill } from "@/lib/bill/schema";

/**
 * CSV files built in the browser with the same CSV libraries the command line uses, so quoting follows
 * guide sections 5.9 and 7.2: columns `bill_id,json`, one JSON object per row on a single line, every
 * quotation mark doubled inside the quoted cell. Level 2 keeps the template's four columns.
 */

export type Level1Row = { billId: string; bill: Bill };
export type Level2Row = { bill_id: string; question_id: string; question: string; answer: string };

const toCsv = (columns: string[], rows: object[]) =>
  stringify(rows, { header: true, columns, record_delimiter: "\n" });

export const buildLevel1Csv = (rows: Level1Row[]) =>
  toCsv(["bill_id", "json"], rows.map((r) => ({ bill_id: r.billId, json: JSON.stringify(r.bill) })));

export const buildLevel2Csv = (rows: Level2Row[]) => toCsv(["bill_id", "question_id", "question", "answer"], rows);

/** What a supplied template file turned out to be. */
export type Template =
  | { kind: "level1"; ids: string[] }
  | { kind: "level2"; rows: Level2Row[] };

/** Recognises level1.csv (bill_id,json) and level2.csv (bill_id,question_id,question,answer) by their header. */
export function readTemplate(text: string): Template | null {
  let rows: Record<string, string>[];
  try {
    rows = parse(text, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true });
  } catch {
    return null;
  }
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);
  if (["bill_id", "question_id", "question", "answer"].every((c) => columns.includes(c))) {
    return {
      kind: "level2",
      rows: rows.map((r) => ({ bill_id: r.bill_id, question_id: r.question_id, question: r.question, answer: "" })),
    };
  }
  if (columns.includes("bill_id") && columns.includes("json")) {
    return { kind: "level1", ids: rows.map((r) => r.bill_id) };
  }
  return null;
}

/** File names without their extension are the bill ids; repeated names get _2, _3, ... */
export function billIdsFromNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const stem = name.replace(/\.[^.]+$/, "").trim() || "bill";
    const n = (seen.get(stem) ?? 0) + 1;
    seen.set(stem, n);
    return n === 1 ? stem : `${stem}_${n}`;
  });
}

/** Saves text as a file download (UTF-8, no BOM). */
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
