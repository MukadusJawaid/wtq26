"use client";

import { useEffect, type ReactNode } from "react";
import { AskStep } from "@/components/ask/ask-step";
// import { BatchStep } from "@/components/batch/batch-step"; // Batch run tab disabled
import { ExtractStep } from "@/components/extract/extract-step";
import { HomeStep } from "@/components/home/home-step";
import { Header } from "@/components/layout/header";
import { Toast } from "@/components/layout/toast";
import { ProcessingOverlay } from "@/components/processing/processing-overlay";
import { UploadStep } from "@/components/upload/upload-step";
import { cn } from "@/lib/utils";
import { STEPS, useAppStore, type Step } from "@/store/app-store";

/** `fit` steps fill the screen on desktop: the page stays put and only an inner pane scrolls. */
const PANELS: { step: Step; fit?: boolean; content: ReactNode }[] = [
  { step: STEPS.home, content: <HomeStep /> },
  { step: STEPS.upload, content: <UploadStep /> },
  { step: STEPS.extract, fit: true, content: <ExtractStep /> },
  { step: STEPS.ask, fit: true, content: <AskStep /> },
  // { step: STEPS.batch, content: <BatchStep /> }, // Batch run tab disabled
];

/** Top-level client shell: header, the step panels (all mounted, one visible), and global overlays. */
export function AppShell() {
  const step = useAppStore((s) => s.step);
  const navigated = useAppStore((s) => Object.keys(s.visited).length > 1);
  const fit = PANELS.find((p) => p.step === step)?.fit ?? false;

  // The "fit" class on <body> switches the page to a fixed-height layout (see app.css).
  useEffect(() => {
    document.body.classList.toggle("fit", fit);
    return () => document.body.classList.remove("fit");
  }, [fit]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main className="wrap" id="main" tabIndex={-1}>
        {PANELS.map((p) => (
          <section
            key={p.step}
            className={cn("panel", step === p.step && "on", navigated && "animate")}
            id={`p${p.step}`}
            role="tabpanel"
            aria-labelledby={`t${p.step}`}
          >
            {p.content}
          </section>
        ))}
      </main>
      <Toast />
      <ProcessingOverlay />
    </>
  );
}
