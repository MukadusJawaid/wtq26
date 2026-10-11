"use client";

import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAsk } from "@/hooks/use-ask";
import type { Analysis } from "@/lib/bill/types";
import { STEPS, useAppStore } from "@/store/app-store";
import { ChatPanel } from "./chat-panel";
import { QuestionPicker } from "./question-picker";

function Conversation({ analysis }: { analysis: Analysis }) {
  const { thread, busy, ask, retry, clear } = useAsk();
  const asked = new Set(thread.map((t) => t.question));

  return (
    <div className="qa fit-body">
      <div className="pane-scroll">
        <QuestionPicker asked={asked} disabled={busy} onAsk={ask} />
      </div>
      <ChatPanel thread={thread} busy={busy} analysis={analysis} asked={asked} onAsk={ask} onRetry={retry} onClear={clear} />
    </div>
  );
}

export function AskStep() {
  const analysis = useAppStore((s) => s.analysis);
  const billVersion = useAppStore((s) => s.billVersion);
  const go = useAppStore((s) => s.go);

  return (
    <>
      <PageHead eyebrow="Ask" title="Ask the bill anything" />
      {analysis ? (
        // Re-keyed per decoded bill so a new bill starts a fresh chat.
        <Conversation key={billVersion} analysis={analysis} />
      ) : (
        <EmptyState
          title="Decode a bill first"
          text="Answers come only from what is printed on your bill, so upload and decode one to start asking."
          action={<Button variant="volt" onClick={() => go(STEPS.upload)}>Go to upload</Button>}
        />
      )}
    </>
  );
}
