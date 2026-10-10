"use client";

import { useCallback } from "react";
import { loadSampleFile } from "@/lib/api";
import { useAppStore, type Step } from "@/store/app-store";

/** Loads the bundled sample bill into the app (through the normal upload path). */
export function useSampleBill() {
  return useCallback(async ({ goTo }: { goTo?: Step } = {}) => {
    const { setFile, go, showToast } = useAppStore.getState();
    try {
      setFile(await loadSampleFile());
      if (goTo) go(goTo);
    } catch {
      showToast("Could not load the sample bill", true);
    }
  }, []);
}
