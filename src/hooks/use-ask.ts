"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, askBill } from "@/lib/api";
import type { Answer } from "@/lib/bill/types";
import { useAppStore } from "@/store/app-store";

export type Turn = {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  answer?: Answer;
  error?: string;
  /** The model is taking a while; show a reassuring caption. */
  slow?: boolean;
};

const SLOW_AFTER_MS = 1800;

/**
 * Chat with the current bill: every question and answer stays in the thread.
 * Answers are cached per question, so repeating a question is instant.
 * Mount it with a `key` tied to the bill so a new bill starts a fresh chat.
 */
export function useAsk() {
  const file = useAppStore((s) => s.file);
  const analysis = useAppStore((s) => s.analysis);
  const cacheAnswer = useAppStore((s) => s.cacheAnswer);

  const [thread, setThread] = useState<Turn[]>([]);
  const nextId = useRef(1);

  const patch = useCallback(
    (id: number, change: Partial<Turn>) =>
      setThread((t) => t.map((turn) => (turn.id === id ? { ...turn, ...change } : turn))),
    [],
  );

  const run = useCallback(
    async (id: number, question: string) => {
      if (!file || !analysis) return;
      const cached = useAppStore.getState().answers[question];
      if (cached) return patch(id, { status: "done", answer: cached, slow: false, error: undefined });

      patch(id, { status: "loading", slow: false, error: undefined });
      const slowTimer = setTimeout(() => patch(id, { slow: true }), SLOW_AFTER_MS);
      try {
        const { answer } = await askBill(file, analysis, question);
        cacheAnswer(question, answer);
        patch(id, { status: "done", answer, slow: false });
      } catch (err) {
        patch(id, {
          status: "error",
          error: err instanceof ApiError ? err.message : "Something went wrong",
          slow: false,
        });
      } finally {
        clearTimeout(slowTimer);
      }
    },
    [file, analysis, cacheAnswer, patch],
  );

  const ask = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || !file || !analysis) return;
      const id = nextId.current++;
      setThread((t) => [...t, { id, question, status: "loading" }]);
      void run(id, question);
    },
    [file, analysis, run],
  );

  const retry = useCallback(
    (id: number) => {
      const turn = thread.find((t) => t.id === id);
      if (turn) void run(id, turn.question);
    },
    [thread, run],
  );

  const clear = useCallback(() => setThread([]), []);
  const busy = thread.some((t) => t.status === "loading");
  return { thread, busy, ask, retry, clear };
}
