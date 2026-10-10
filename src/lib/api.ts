import type { Analysis, Answer } from "@/lib/bill/types";

/** Thin client for the app's own API routes. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "offline" | "server" | "aborted",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, signal: outer, ...rest } = init;
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;
  outer?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, "server", res.status);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (timedOut) throw new ApiError("The model did not reply in time", "timeout");
    if (controller.signal.aborted) throw new ApiError("Cancelled", "aborted");
    throw new ApiError(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "You appear to be offline"
        : "Could not reach the server",
      navigator.onLine === false ? "offline" : "server",
    );
  } finally {
    clearTimeout(timer);
  }
}

const form = (entries: Record<string, string | Blob>) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(entries)) body.set(k, v);
  return body;
};

export const DECODE_TIMEOUT_MS = 90_000;
export const ANSWERS_TIMEOUT_MS = 120_000;
export const ASK_TIMEOUT_MS = 60_000;

export const decodeBill = (file: File, signal?: AbortSignal) =>
  request<Analysis>("/api/analyze", {
    method: "POST",
    body: form({ file }),
    signal,
    timeoutMs: DECODE_TIMEOUT_MS,
  });

export const askBill = (file: File, analysis: Analysis, question: string, signal?: AbortSignal) =>
  request<{ answer: Answer }>("/api/ask", {
    method: "POST",
    body: form({ file, analysis: JSON.stringify(analysis), question }),
    signal,
    timeoutMs: ASK_TIMEOUT_MS,
  });


/** Answers a whole list of questions for one decoded bill (used to fill level2.csv). */
export const answerAll = (
  file: File,
  analysis: Analysis,
  questions: { id: string; text: string }[],
  signal?: AbortSignal,
) =>
  request<{ answers: Record<string, Answer> }>("/api/answers", {
    method: "POST",
    body: form({ file, analysis: JSON.stringify(analysis), questions: JSON.stringify(questions) }),
    signal,
    timeoutMs: ANSWERS_TIMEOUT_MS,
  });

/** Fetches the bundled sample bill image as a File so it goes through the same upload path. */
export async function loadSampleFile(): Promise<File> {
  const res = await fetch("/samples/KESC_0008.png");
  if (!res.ok) throw new ApiError("Could not load the sample bill", "server", res.status);
  return new File([await res.blob()], "KESC_0008.png", { type: "image/png" });
}
