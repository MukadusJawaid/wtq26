import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export type Level1Row = { bill_id: string; json: string };
export type Level2Row = { bill_id: string; question_id: string; question: string; answer: string };

export const LEVEL1_COLUMNS = ["bill_id", "json"] as const;
export const LEVEL2_COLUMNS = ["bill_id", "question_id", "question", "answer"] as const;

/** Reads a CSV template (UTF-8, optional BOM) into row objects keyed by header. */
export async function readCsv<T>(file: string): Promise<T[]> {
  return parse(await readFile(file, "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as T[];
}

/** Writes rows with the original column order; quoting/escaping is handled by the library. */
export async function writeCsv(file: string, columns: readonly string[], rows: object[]) {
  await writeFile(
    file,
    stringify(rows, { header: true, columns: [...columns], record_delimiter: "\n" }),
    "utf8",
  );
}
