"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Eases a number up from 0 to `target` (instant when the user prefers reduced motion). */
export function useCountUp(target: number | null, durationMs = 800): number | null {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
  const [frame, setFrame] = useState<{ target: number; value: number } | null>(null);

  useEffect(() => {
    if (target == null || reduced) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const p = Math.min(1, (now - start) / durationMs);
      setFrame({ target, value: target * (1 - Math.pow(1 - p, 3)) });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, durationMs]);

  if (target == null || reduced) return target;
  // Until the first frame of a new target arrives, start from zero rather than a stale value.
  return frame?.target === target ? frame.value : 0;
}
