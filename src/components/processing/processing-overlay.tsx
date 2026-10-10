"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mascot, type MascotState } from "@/components/ui/mascot";
import { loadSampleFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { cancelDecode, LOADING_MESSAGES, startDecode } from "@/store/decode-controller";

const STEP_LABELS = ["Upload", "Read text", "Find fields", "Check totals"];
const TIPS = ["Check your internet connection", "Try a smaller or clearer photo", "Retry in a moment. Nothing is lost."];

/** Modal shown while a bill is being decoded: progress, friendly messages, and recoverable errors. */
export function ProcessingOverlay() {
  const { phase, progress, messageIndex, error } = useAppStore((s) => s.decode);
  const open = phase !== "idle";
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);

  // Lock page scroll, move focus into the dialog, restore it on close.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement;
    document.body.classList.add("lock");
    cardRef.current?.focus();
    return () => {
      document.body.classList.remove("lock");
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return cancelDecode();
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>("button")].filter((b) => b.offsetParent);
      if (!focusable.length) return e.preventDefault();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === cardRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function useSample() {
    try {
      useAppStore.getState().setFile(await loadSampleFile());
      await startDecode();
    } catch {
      useAppStore.getState().showToast("Could not load the sample bill", true);
    }
  }

  if (!open) return null;

  const failed = phase === "error";
  const dataS = failed ? "err" : phase === "slow" ? "slow" : phase === "success" ? "ok" : "load";
  const mascot: MascotState = failed ? "err" : phase === "slow" ? "slow" : phase === "success" ? "idle" : "load";

  const title = failed
    ? (error?.title ?? "Something went wrong")
    : phase === "slow"
      ? "Taking longer than usual…"
      : phase === "success"
        ? "Got it!"
        : "Reading your bill…";
  const message = failed
    ? (error?.message ?? "")
    : phase === "slow"
      ? "Hang tight. The model is thinking hard, and your bill is safe."
      : phase === "success"
        ? "Every number found and checked."
        : LOADING_MESSAGES[messageIndex];

  const stepIndex = Math.min(3, Math.floor(progress / 25));

  return (
    <div
      className="proc"
      data-s={dataS}
      role="dialog"
      aria-modal="true"
      aria-labelledby="procT"
      onClick={(e) => e.target === e.currentTarget && cancelDecode()}
    >
      <div className="proc-card" tabIndex={-1} ref={cardRef}>
        <div className="mbox">
          <Mascot state={mascot} />
        </div>
        <h2 id="procT">{title}</h2>
        <p className="proc-msg swap" key={message} aria-live="polite">
          {message}
        </p>
        <ol className="psteps">
          {STEP_LABELS.map((label, i) => (
            <li key={label} className={phase === "success" || i < stepIndex ? "done" : i === stepIndex ? "on" : ""}>
              {label}
            </li>
          ))}
        </ol>
        <div className={cn("pbar", failed && "bad")}>
          <i style={{ width: `${progress}%` }} />
        </div>
        {failed && (
          <div className="proc-err">
            <b>What you can try</b>
            <ul>
              {(error?.tips ?? TIPS).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <span className="code">{error?.code}</span>
          </div>
        )}
        <div className="proc-acts">
          {failed ? (
            <>
              <Button onClick={() => startDecode()} autoFocus>
                Try again
              </Button>
              <Button variant="sec" onClick={useSample}>
                Use the sample bill
              </Button>
              <Button variant="sec" onClick={cancelDecode}>
                Close
              </Button>
            </>
          ) : phase === "success" ? null : (
            <Button variant="sec" onClick={cancelDecode}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
