import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_EXTENSIONS, toImage } from "../bill/files";
import { analyzeBill, answerQuestions, type Analysis } from "../bill/pipeline";
import {
  billSchema,
  findInconsistencies,
  normalizeBill,
  type Answer,
} from "../bill/schema";
import {
  LEVEL1_COLUMNS,
  LEVEL2_COLUMNS,
  readCsv,
  writeCsv,
  type Level1Row,
  type Level2Row,
} from "./csv";
import type { BatchPaths } from "./paths";

/**
 * Batch engine shared by the CLI (`npm run generate`) and the Batch screen.
 * Bills are processed with limited concurrency; every finished bill is
 * checkpointed so a failed run can resume without redoing the others.
 */

export type BatchStage = "read" | "extract" | "validate" | "answer" | "write";

export type BatchEvent =
  | { type: "start"; bills: number; questions: number; rows1: number; rows2: number }
  | { type: "stage"; stage: BatchStage }
  | { type: "bill"; id: string; index: number; status: "start" | "extracted" | "answered" | "failed"; message?: string }
  | { type: "warn"; id: string; message: string }
  | { type: "progress"; percent: number }
  | { type: "done"; failed: string[]; rows1: number; rows2: number }
  | { type: "error"; message: string };

export type BatchOptions = {
  paths: BatchPaths;
  /** Reuse checkpoints from a previous run (resume). When false, start clean. */
  resume?: boolean;
  concurrency?: number;
  signal?: AbortSignal;
  onEvent?: (event: BatchEvent) => void;
};

type Checkpoint = { analysis: Analysis; answers: Record<string, Answer> };

const RETRIES = 3;
const FALLBACK_ANSWER = "Unable to answer: the bill could not be processed.";

const emptyBillJson = () =>
  JSON.stringify(
    normalizeBill(
      billSchema.parse({
        provider: null, tariff: null, sanctioned_load_kw: null, bill_month: null,
        reading_date: null, issue_date: null, due_date: null, previous_reading: null,
        current_reading: null, units_consumed: null, charges: [], total_charges: null,
        taxes: [], total_taxes: null, current_bill: null, arrears: null,
        payable_within_due_date: null, payable_after_due_date: null,
      }),
    ),
  );

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  onRetry: (message: string) => void,
  signal?: AbortSignal,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("cancelled");
    try {
      return await fn();
    } catch (err) {
      last = err;
      onRetry(`${label}: attempt ${attempt}/${RETRIES} failed: ${(err as Error).message}`);
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw last;
}

async function findImage(dir: string, billId: string) {
  const files = await readdir(dir);
  const name = files.find((f) => {
    const { name: stem, ext } = path.parse(f);
    return stem === billId && IMAGE_EXTENSIONS.includes(ext.slice(1).toLowerCase());
  });
  if (!name) throw new Error(`no image named ${billId} in ${dir}`);
  return toImage(name, new Uint8Array(await readFile(path.join(dir, name))));
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index], index);
      }
    }),
  );
}

export type BatchInfo = {
  ready: boolean;
  bills: number;
  questions: number;
  rows1: number;
  rows2: number;
  missing: string[];
};

/** Inspects the templates and bill folder without calling the model. */
export async function inspectBatch(paths: BatchPaths): Promise<BatchInfo> {
  const missing: string[] = [];
  let l1: Level1Row[] = [];
  let l2: Level2Row[] = [];
  try {
    l1 = await readCsv<Level1Row>(path.join(paths.templatesDir, "level1.csv"));
  } catch {
    missing.push("test/csv/level1.csv");
  }
  try {
    l2 = await readCsv<Level2Row>(path.join(paths.templatesDir, "level2.csv"));
  } catch {
    missing.push("test/csv/level2.csv");
  }
  if (l1.length) {
    const images = await readdir(paths.billsDir).catch(() => [] as string[]);
    const stems = new Set(
      images
        .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).slice(1).toLowerCase()))
        .map((f) => path.parse(f).name),
    );
    const absent = l1.filter((r) => !stems.has(r.bill_id)).map((r) => `test/bills/${r.bill_id}.png`);
    if (absent.length) missing.push(...absent);
  }
  const questions = new Set(l2.map((r) => r.question_id)).size;
  return { ready: !missing.length && l1.length > 0, bills: l1.length, questions, rows1: l1.length, rows2: l2.length, missing };
}

export async function runBatch(options: BatchOptions): Promise<{ failed: string[] }> {
  const { paths, resume = false, concurrency = 3, signal, onEvent = () => {} } = options;
  const workDir = path.join(paths.outDir, ".work");
  const emit = onEvent;

  const l1 = await readCsv<Level1Row>(path.join(paths.templatesDir, "level1.csv"));
  const l2 = await readCsv<Level2Row>(path.join(paths.templatesDir, "level2.csv"));
  emit({ type: "start", bills: l1.length, questions: new Set(l2.map((r) => r.question_id)).size, rows1: l1.length, rows2: l2.length });

  if (!resume) await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  emit({ type: "stage", stage: "read" });
  const total = l1.length;
  let extracted = 0;
  let answered = 0;
  const failed: string[] = [];
  const progress = () =>
    emit({ type: "progress", percent: Math.min(95, Math.round(((extracted * 0.45 + answered * 0.5) / Math.max(1, total)) * 100)) });

  await pool(l1, concurrency, async (row, index) => {
    const id = row.bill_id;
    const rows = l2.filter((r) => r.bill_id === id);
    const cacheFile = path.join(workDir, `${id}.json`);
    emit({ type: "bill", id, index, status: "start" });
    if (extracted === 0) emit({ type: "stage", stage: "extract" });
    try {
      if (signal?.aborted) throw new Error("cancelled");

      let cached: Checkpoint | null = null;
      if (resume) {
        cached = JSON.parse(await readFile(cacheFile, "utf8").catch(() => "null"));
      }

      const image = await findImage(paths.billsDir, id);
      const retryNote = (message: string) => emit({ type: "warn", id, message });

      const analysis =
        cached?.analysis ?? (await withRetry(`${id} extract`, () => analyzeBill(image), retryNote, signal));
      // Checkpoint immediately so a later failure never repeats the extraction.
      if (!cached) await writeFile(cacheFile, JSON.stringify({ analysis, answers: {} } satisfies Checkpoint));
      extracted++;
      emit({ type: "bill", id, index, status: "extracted" });
      emit({ type: "stage", stage: "validate" });
      for (const issue of findInconsistencies(analysis.bill)) {
        emit({ type: "warn", id, message: `check: ${issue}` });
      }
      progress();

      emit({ type: "stage", stage: "answer" });
      const have = cached?.answers ?? {};
      const todo = rows.filter((r) => !have[r.question_id]);
      const fresh = todo.length
        ? await withRetry(
            `${id} answers`,
            () => answerQuestions(image, analysis, todo.map((r) => ({ id: r.question_id, text: r.question }))),
            retryNote,
            signal,
          )
        : new Map<string, Answer>();
      const answers: Record<string, Answer> = { ...have, ...Object.fromEntries(fresh) };

      row.json = JSON.stringify(analysis.bill);
      for (const r of rows) r.answer = answers[r.question_id].answer;
      await writeFile(cacheFile, JSON.stringify({ analysis, answers } satisfies Checkpoint));
      answered++;
      emit({ type: "bill", id, index, status: "answered" });
      progress();
    } catch (err) {
      failed.push(id);
      const message = (err as Error).message;
      emit({ type: "bill", id, index, status: "failed", message });
      // Never leave a cell empty: Level 1 falls back to the all-null object,
      // Level 2 states plainly that the answer could not be produced.
      row.json ||= emptyBillJson();
      for (const r of rows) r.answer ||= FALLBACK_ANSWER;
    }
  });

  emit({ type: "stage", stage: "write" });
  await mkdir(paths.outDir, { recursive: true });
  await writeCsv(path.join(paths.outDir, "level1.csv"), LEVEL1_COLUMNS, l1);
  await writeCsv(path.join(paths.outDir, "level2.csv"), LEVEL2_COLUMNS, l2);
  emit({ type: "progress", percent: 100 });
  emit({ type: "done", failed, rows1: l1.length, rows2: l2.length });
  return { failed };
}
