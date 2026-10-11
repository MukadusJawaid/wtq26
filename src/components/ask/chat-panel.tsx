"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mascot } from "@/components/ui/mascot";
import type { Turn } from "@/hooks/use-ask";
import type { Analysis } from "@/lib/bill/types";
import { Icon } from "@/components/ui/icon";
import { SUGGESTED_QUESTIONS } from "@/lib/bill/questions";
import { ChatTurn } from "./chat-turn";

/** The conversation: scrolling thread on top, message box pinned to the bottom. */
export function ChatPanel({
  thread,
  busy,
  analysis,
  asked,
  onAsk,
  onRetry,
  onClear,
}: {
  thread: Turn[];
  busy: boolean;
  analysis: Analysis;
  /** Questions already asked, marked in the strip. */
  asked: Set<string>;
  onAsk: (question: string) => void;
  onRetry: (id: number) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const last = thread[thread.length - 1];

  // Follow the newest message as the thread grows or a reply arrives.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thread.length, last?.status]);

  return (
    <Card className="chat" aria-live="polite">
      <div className="chat-head">
        <h3>Chat about this bill</h3>
        {thread.length > 0 && (
          <Button variant="sec" disabled={busy} onClick={onClear}>
            Clear chat
          </Button>
        )}
      </div>

      <div className="chat-body" ref={bodyRef}>
        {thread.length === 0 ? (
          <div className="chat-empty">
            <div className="mbox">
              <Mascot state="idle" />
            </div>
            <p>Pick a suggested question or type your own. Every answer comes only from what is printed on your bill.</p>
          </div>
        ) : (
          thread.map((turn) => <ChatTurn key={turn.id} turn={turn} analysis={analysis} onRetry={onRetry} />)
        )}
      </div>

      <div className="composer">
        {/* phones: the suggested questions sit right above the message box (the side card is hidden) */}
        <div className="qstrip" role="group" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map(({ text, icon }) => (
            <button key={text} className="chip" type="button" aria-pressed={asked.has(text)} disabled={busy} onClick={() => onAsk(text)}>
              <Icon name={icon} />
              <span>{text}</span>
            </button>
          ))}
        </div>
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || busy) return;
            onAsk(draft);
            setDraft("");
          }}
        >
          <label htmlFor="qin" className="sr-only">
            Type your own question
          </label>
          <input
            id="qin"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about this bill…"
            autoComplete="off"
            maxLength={500}
          />
          <Button type="submit" disabled={busy || !draft.trim()}>
            Ask
          </Button>
        </form>
      </div>
    </Card>
  );
}
