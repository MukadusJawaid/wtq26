"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SUGGESTED_QUESTIONS } from "@/lib/bill/questions";

/** Suggested questions (already-asked ones are marked) and the legend for how answers are tagged. */
export function QuestionPicker({
  asked,
  disabled,
  onAsk,
}: {
  asked: Set<string>;
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <>
      <Card style={{ padding: 24 }}>
        <h3>Try a question</h3>
        <div className="chips">
          {SUGGESTED_QUESTIONS.map(({ text, icon }) => (
            <button
              key={text}
              className="chip"
              type="button"
              aria-pressed={asked.has(text)}
              disabled={disabled}
              onClick={() => onAsk(text)}
            >
              <Icon name={icon} />
              <span>{text}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="legend">
        <span style={{ font: "700 12.5px var(--sans)", color: "var(--muted)" }}>How answers are tagged</span>
        <div className="tags">
          <Badge tone="pri">From the bill</Badge>
          <Badge tone="ok">Calculated</Badge>
          <Badge tone="warn">Estimate</Badge>
          <Badge tone="bad">Not on this bill</Badge>
        </div>
      </Card>
    </>
  );
}
