"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, answerAll, decodeBill } from "@/lib/api";
import type { Analysis } from "@/lib/bill/types";
import { shrinkForUpload } from "@/lib/image-client";
import {
  billIdsFromNames,
  buildLevel1Csv,
  buildLevel2Csv,
  downloadText,
  readTemplate,
  type Level2Row,
} from "@/lib/level1-csv";
import { useAppStore } from "@/store/app-store";

export type BulkStatus = "queued" | "reading" | "answering" | "done" | "failed";

export type BulkItem = {
  id: number;
  file: File;
  /** Object URL for the thumbnail; revoked when the bill is removed. */
  previewUrl: string;
  status: BulkStatus;
  analysis?: Analysis;
  /** Answers keyed by question id, filled when a questions file is attached. */
  answers?: Record<string, string>;
  error?: string;
};

const MAX_FILES = 30;
const MAX_BYTES = 10 * 1024 * 1024;
const CONCURRENCY = 3;
const ACCEPTED = /^image\/(png|jpeg)$/;

type Questions = { id: string; text: string }[];

/** Questions for a bill: its own rows in the template, else the first bill's list (the same 12 for all). */
function questionsIn(rows: Level2Row[] | null, billId: string): Questions {
  if (!rows?.length) return [];
  const own = rows.filter((r) => r.bill_id === billId);
  const source = own.length ? own : rows.filter((r) => r.bill_id === rows[0].bill_id);
  return source.map((r) => ({ id: r.question_id, text: r.question }));
}

/** A bill needs work until it is read and, when questions are attached, answered. */
function needsWork(item: BulkItem, questions: Questions): boolean {
  if (item.status === "reading" || item.status === "answering") return false;
  return !item.analysis || (questions.length > 0 && !item.answers);
}

/**
 * The upload flow for the competition files: queue several bills, optionally attach the supplied
 * level2.csv (the questions) and level1.csv (row order), read every bill, answer its questions, and
 * build level1.csv / level2.csv from the results. Bills are processed three at a time.
 */
export function useBulkUpload() {
  const showToast = useAppStore((s) => s.showToast);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [level1Ids, setLevel1Ids] = useState<string[] | null>(null);
  const [level2Rows, setLevel2Rows] = useState<Level2Row[] | null>(null);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [customFiles, setCustomFiles] = useState<{ level1: string | null; level2: string | null }>({ level1: null, level2: null });
  const [defaultBills, setDefaultBills] = useState<string[]>([]);
  const defaults = useRef<{ level1: string[] | null; level2: Level2Row[] | null }>({ level1: null, level2: null });
  const nextId = useRef(1);
  const itemsRef = useRef<BulkItem[]>([]);
  const level2Ref = useRef<Level2Row[] | null>(null);

  const commit = useCallback((next: BulkItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);
  const patch = useCallback(
    (id: number, change: Partial<BulkItem>) =>
      commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...change } : it))),
    [commit],
  );

  const ids = useMemo(() => billIdsFromNames(items.map((i) => i.file.name)), [items]);

  const add = useCallback(
    async (files: File[]) => {
      const known = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}`));
      const accepted: File[] = [];
      let skipped = 0;
      for (const f of files) {
        const key = `${f.name}:${f.size}`;
        if (!ACCEPTED.test(f.type) || f.size > MAX_BYTES || known.has(key)) skipped++;
        else {
          known.add(key); // also catches repeats inside this same selection
          accepted.push(f);
        }
      }
      const room = Math.max(0, MAX_FILES - itemsRef.current.length);
      if (accepted.length > room) skipped += accepted.length - room;
      const prepared = await Promise.all(accepted.slice(0, room).map(shrinkForUpload));
      commit([
        ...itemsRef.current,
        ...prepared.map((file) => ({
          id: nextId.current++,
          file,
          previewUrl: URL.createObjectURL(file),
          status: "queued" as const,
        })),
      ]);
      if (skipped) {
        showToast(`${skipped} file${skipped > 1 ? "s were" : " was"} skipped (PNG/JPG up to 10 MB, no duplicates, max ${MAX_FILES})`, true);
      }
    },
    [commit, showToast],
  );

  // The supplied templates (test/csv/level1.csv and level2.csv) are loaded automatically.
  useEffect(() => {
    let alive = true;
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: { level1: string | null; level2: string | null }) => {
        if (!alive) return;
        const l1 = data.level1 ? readTemplate(data.level1) : null;
        const l2 = data.level2 ? readTemplate(data.level2) : null;
        if (l1?.kind === "level1") {
          defaults.current.level1 = l1.ids;
          setLevel1Ids(l1.ids);
        }
        if (l2?.kind === "level2") {
          defaults.current.level2 = l2.rows;
          level2Ref.current = l2.rows;
          setLevel2Rows(l2.rows);
        }
        setTemplatesLoaded(true);
      })
      .catch(() => alive && setTemplatesLoaded(true));
    // The supplied bills (test/bills) are used when the user adds none of their own.
    fetch("/api/sample-bills")
      .then((r) => r.json())
      .then((data: { bills: string[] }) => alive && setDefaultBills(data.bills))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /** Replaces the preselected level1.csv or level2.csv with the user's own file. */
  const chooseTemplate = useCallback(
    async (kind: "level1" | "level2", file: File) => {
      const parsed = readTemplate(await file.text());
      if (parsed?.kind !== kind) {
        showToast(`That does not look like a ${kind}.csv file`, true);
        return;
      }
      if (parsed.kind === "level1") setLevel1Ids(parsed.ids);
      else {
        level2Ref.current = parsed.rows;
        setLevel2Rows(parsed.rows);
      }
      setCustomFiles((c) => ({ ...c, [kind]: file.name }));
    },
    [showToast],
  );

  /** Goes back to the preselected file. */
  const resetTemplate = useCallback((kind: "level1" | "level2") => {
    if (kind === "level1") setLevel1Ids(defaults.current.level1);
    else {
      level2Ref.current = defaults.current.level2;
      setLevel2Rows(defaults.current.level2);
    }
    setCustomFiles((c) => ({ ...c, [kind]: null }));
  }, []);

  const remove = useCallback(
    (id: number) => {
      const gone = itemsRef.current.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      commit(itemsRef.current.filter((i) => i.id !== id));
    },
    [commit],
  );
  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    commit([]);
  }, [commit]);

  const run = useCallback(async () => {
    const currentIds = billIdsFromNames(itemsRef.current.map((i) => i.file.name));
    const todo = itemsRef.current
      .map((item, i) => ({ item, billId: currentIds[i] }))
      .filter(({ item, billId }) => needsWork(item, questionsIn(level2Ref.current, billId)));
    if (!todo.length) return;
    setRunning(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const { item, billId } = todo[cursor++];
        try {
          let analysis = item.analysis;
          if (!analysis) {
            patch(item.id, { status: "reading", error: undefined });
            analysis = await decodeBill(item.file);
            patch(item.id, { analysis });
          }
          const questions = questionsIn(level2Ref.current, billId);
          if (questions.length) {
            patch(item.id, { status: "answering", error: undefined });
            const { answers } = await answerAll(item.file, analysis, questions);
            patch(item.id, {
              status: "done",
              answers: Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, a.answer])),
            });
          } else {
            patch(item.id, { status: "done" });
          }
        } catch (err) {
          patch(item.id, { status: "failed", error: err instanceof ApiError ? err.message : "Something went wrong" });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
    setRunning(false);
  }, [patch]);

  /** One click: loads the supplied bills when none were added, then reads and answers them all. */
  const generate = useCallback(async () => {
    if (!itemsRef.current.length) {
      try {
        const files = await Promise.all(
          defaultBills.map(async (name) => {
            const res = await fetch(`/api/sample-bills?name=${encodeURIComponent(name)}`);
            if (!res.ok) throw new Error(name);
            const blob = await res.blob();
            return new File([blob], name, { type: blob.type });
          }),
        );
        await add(files);
      } catch {
        showToast("Could not load the supplied bills", true);
        return;
      }
    }
    await run();
  }, [add, defaultBills, run, showToast]);

  /** level1.csv: template order first (when supplied), then any other bills, one row per read bill. */
  const downloadLevel1 = useCallback(() => {
    const currentIds = billIdsFromNames(itemsRef.current.map((i) => i.file.name));
    const read = itemsRef.current
      .map((item, i) => ({ billId: currentIds[i], bill: item.analysis?.bill }))
      .filter((r): r is { billId: string; bill: NonNullable<typeof r.bill> } => !!r.bill);
    if (!read.length) return;
    const rank = (id: string) => {
      const at = level1Ids?.indexOf(id) ?? -1;
      return at === -1 ? Number.MAX_SAFE_INTEGER : at;
    };
    read.sort((a, b) => rank(a.billId) - rank(b.billId));
    downloadText("level1.csv", buildLevel1Csv(read));
  }, [level1Ids]);

  /** level2.csv: the template's rows, in the template's order, with the model's answers filled in. */
  const downloadLevel2 = useCallback(() => {
    if (!level2Rows) return;
    const currentIds = billIdsFromNames(itemsRef.current.map((i) => i.file.name));
    const answersById = new Map(itemsRef.current.map((item, i) => [currentIds[i], item.answers]));
    // Only rows whose bill was uploaded and answered are written; ids must match the file names.
    const rows = level2Rows
      .map((r) => ({ ...r, answer: answersById.get(r.bill_id)?.[r.question_id] ?? "" }))
      .filter((r) => r.answer);
    if (!rows.length) return;
    downloadText("level2.csv", buildLevel2Csv(rows));
  }, [level2Rows]);

  const answered = items.filter((i) => i.answers).length;
  const counts = {
    total: items.length,
    done: items.filter((i) => i.status === "done").length,
    failed: items.filter((i) => i.status === "failed").length,
    pending: items.filter((item, i) => needsWork(item, questionsIn(level2Rows, ids[i]))).length,
    answered,
    questionsPerBill: level2Rows ? new Set(level2Rows.map((r) => r.question_id)).size : 0,
    templateBills: level2Rows ? new Set(level2Rows.map((r) => r.bill_id)) : new Set<string>(),
  };
  const missingBills = [...counts.templateBills].filter((b) => !ids.includes(b));
  const hasQuestions = !!level2Rows;

  return {
    items,
    ids,
    running,
    counts,
    missingBills,
    hasQuestions,
    hasLevel1Template: !!level1Ids,
    templatesLoaded,
    customFiles,
    defaultBillCount: defaultBills.length,
    chooseTemplate,
    resetTemplate,
    generate,
    add,
    remove,
    clear,
    run,
    downloadLevel1,
    downloadLevel2,
  };
}
