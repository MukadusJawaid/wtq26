"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const VISIBLE_MS = 2600;

/** Transient message at the bottom of the screen; errors are styled differently. */
export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const dismiss = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className={cn("toast", toast && "on", toast?.error && "err")} role="status">
      {toast?.message}
    </div>
  );
}
