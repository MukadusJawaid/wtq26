import { ApiError, decodeBill } from "@/lib/api";
import { STEPS, useAppStore, type DecodeError } from "./app-store";

/**
 * Drives the "decode this bill" flow: calls the real API and animates the
 * progress UI around it. Timers live here (not in components) so the overlay
 * can mount/unmount freely.
 */

const SLOW_AFTER_MS = 15_000;
const TICK_MS = 100;
const MESSAGE_EVERY_MS = 2_000;
const SUCCESS_HOLD_MS = 950;

export const LOADING_MESSAGES = [
  "Squinting at the tilted photo…",
  "Reading the Urdu labels…",
  "Tiptoeing around the grey boxes…",
  "Counting units, one by one…",
  "Checking the maths twice…",
  "Tidying up the numbers…",
];

let controller: AbortController | null = null;
const timers = new Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>();

function clearTimers() {
  timers.forEach((t) => {
    clearTimeout(t as ReturnType<typeof setTimeout>);
    clearInterval(t as ReturnType<typeof setInterval>);
  });
  timers.clear();
}

const store = () => useAppStore.getState();

function describeError(err: unknown): DecodeError {
  if (err instanceof ApiError) {
    if (err.kind === "offline") {
      return {
        title: "You're offline",
        message: "The connection dropped. Reconnect and we'll pick up where you left off.",
        code: "NETWORK_OFFLINE · request not sent · safe to retry",
      };
    }
    if (err.kind === "timeout") {
      return {
        title: "The model stopped responding",
        message: "No reply came back in time, so we stopped waiting. That is on our side, not your bill. Nothing was lost.",
        code: "TIMEOUT · request aborted · safe to retry",
      };
    }
    if (err.status === 422) {
      return {
        title: "That isn't a supported bill",
        message: err.message,
        code: "REJECTED · not a K-Electric, LESCO or IESCO electricity bill",
        tips: [
          "Upload a K-Electric, LESCO or IESCO electricity bill",
          "Make sure the whole bill is in the picture",
          "Other documents and utility bills are not accepted",
        ],
      };
    }
    return {
      title: err.status && err.status < 500 ? "We couldn't read that file" : "Something went wrong",
      message: err.message,
      code: `HTTP ${err.status ?? "?"} · ${err.message.slice(0, 120)}`,
    };
  }
  return { title: "Something went wrong", message: "An unexpected error occurred.", code: String(err).slice(0, 120) };
}

export function cancelDecode() {
  controller?.abort();
  controller = null;
  clearTimers();
  store().patchDecode({ phase: "idle", progress: 0, error: null });
}

export async function startDecode() {
  const { file } = store();
  if (!file) return;

  controller?.abort();
  clearTimers();
  controller = new AbortController();
  const mine = controller;

  store().patchDecode({ phase: "loading", progress: 0, messageIndex: 0, error: null });

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    store().patchDecode({ phase: "error", error: describeError(new ApiError("offline", "offline")) });
    return;
  }

  // Progress eases toward a ceiling until the real response arrives.
  timers.add(
    setInterval(() => {
      const { decode } = store();
      const ceiling = decode.phase === "slow" ? 92 : 86;
      const rate = decode.phase === "slow" ? 0.012 : 0.035;
      store().patchDecode({ progress: decode.progress + (ceiling - decode.progress) * rate });
    }, TICK_MS),
  );
  timers.add(
    setInterval(() => {
      const { decode } = store();
      if (decode.phase === "loading") {
        store().patchDecode({ messageIndex: (decode.messageIndex + 1) % LOADING_MESSAGES.length });
      }
    }, MESSAGE_EVERY_MS),
  );
  timers.add(
    setTimeout(() => {
      if (store().decode.phase === "loading") store().patchDecode({ phase: "slow" });
    }, SLOW_AFTER_MS),
  );

  try {
    const analysis = await decodeBill(file, mine.signal);
    if (mine.signal.aborted) return;
    clearTimers();
    store().setAnalysis(analysis);
    store().patchDecode({ phase: "success", progress: 100 });
    timers.add(
      setTimeout(() => {
        store().patchDecode({ phase: "idle", progress: 0 });
        store().go(STEPS.extract);
      }, SUCCESS_HOLD_MS),
    );
  } catch (err) {
    if (mine.signal.aborted && err instanceof ApiError && err.kind === "aborted") return;
    clearTimers();
    store().patchDecode({ phase: "error", error: describeError(err) });
  }
}
