import { create } from "zustand";
import type { Analysis, Answer } from "@/lib/bill/types";

export type Step = 1 | 2 | 3 | 4 | 5;
export const STEPS = { home: 1, upload: 2, extract: 3, ask: 4, batch: 5 } as const satisfies Record<string, Step>;

export type DecodePhase = "idle" | "loading" | "slow" | "error" | "success";

export type DecodeError = {
  title: string;
  message: string;
  /** Short technical line shown under the tips (status or timeout). */
  code: string;
  /** Replaces the default retry tips when the fix is specific (e.g. wrong kind of document). */
  tips?: string[];
};

type Toast = { id: number; message: string; error: boolean };

type AppState = {
  // navigation
  step: Step;
  visited: Partial<Record<Step, boolean>>;
  go: (step: Step) => void;

  // the bill being worked on
  file: File | null;
  previewUrl: string | null;
  analysis: Analysis | null;
  /** Bumps whenever a new bill is decoded; used to reset per-bill UI state. */
  billVersion: number;
  setFile: (file: File | null) => void;
  setAnalysis: (analysis: Analysis) => void;

  // decode progress (driven by decode-controller)
  decode: { phase: DecodePhase; progress: number; messageIndex: number; error: DecodeError | null };
  patchDecode: (patch: Partial<AppState["decode"]>) => void;

  // Level 2 answers, cached per question for the current bill
  answers: Record<string, Answer>;
  cacheAnswer: (question: string, answer: Answer) => void;

  // toasts
  toast: Toast | null;
  showToast: (message: string, error?: boolean) => void;
  dismissToast: () => void;
};

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  step: 1,
  visited: { 1: true },
  go: (step) => {
    set((s) => ({ step, visited: { ...s.visited, [step]: true } }));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  },

  file: null,
  previewUrl: null,
  analysis: null,
  billVersion: 0,
  setFile: (file) => {
    const prev = get().previewUrl;
    if (prev) URL.revokeObjectURL(prev);
    // A different bill invalidates everything derived from the old one.
    set({
      file,
      previewUrl: file ? URL.createObjectURL(file) : null,
      analysis: null,
      answers: {},
    });
  },
  setAnalysis: (analysis) => set((s) => ({ analysis, answers: {}, billVersion: s.billVersion + 1 })),

  decode: { phase: "idle", progress: 0, messageIndex: 0, error: null },
  patchDecode: (patch) => set((s) => ({ decode: { ...s.decode, ...patch } })),

  answers: {},
  cacheAnswer: (question, answer) => set((s) => ({ answers: { ...s.answers, [question]: answer } })),

  toast: null,
  showToast: (message, error = false) => set({ toast: { id: ++toastId, message, error } }),
  dismissToast: () => set({ toast: null }),
}));
