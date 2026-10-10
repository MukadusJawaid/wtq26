"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import type { Turn } from "@/hooks/use-ask";
import { appearsInText, evaluate, formatResult, prettyExpression } from "@/lib/calc";
import { emphasisParts } from "@/lib/format";
import type { Analysis, Answer } from "@/lib/bill/types";
import { HistoryChart, TaxBreakdown, thresholdFromQuestion } from "./answer-visuals";

const TAGS: Record<Answer["tags"][number], { label: string; tone: BadgeTone }> = {
  bill: { label: "From the bill", tone: "pri" },
  calculated: { label: "Calculated", tone: "ok" },
  estimate: { label: "Estimate", tone: "warn" },
  not_on_bill: { label: "Not on this bill", tone: "bad" },
};

/**
 * The formula behind an answer. The model only proposes the expression; the
 * result is computed here, and the badge says whether it matches the answer text.
 */
function Calculation({ calc, answerText }: { calc: NonNullable<Answer["calculation"]>; answerText: string }) {
  const value = evaluate(calc.expression);
  if (value === null) return null; // never display a formula we could not compute
  const matches = appearsInText(value, answerText);
  return (
    <div className="calc">
      {prettyExpression(calc.expression)} <em>=</em> {formatResult(value, calc.unit)}
      <Badge tone={matches ? "ok" : "warn"}>{matches ? "✓ computed by the app" : "! differs from the answer"}</Badge>
    </div>
  );
}

/** One exchange in the chat: the question bubble, then typing dots, an error, or the model's answer. */
export function ChatTurn({
  turn,
  analysis,
  onRetry,
}: {
  turn: Turn;
  analysis: Analysis;
  onRetry: (id: number) => void;
}) {
  const { question, status, answer, error, slow } = turn;

  return (
    <div className="turn">
      <div className="me">
        <span className="qb">{question}</span>
      </div>

      <div className="reply">
        {status === "loading" && (
          <>
            <div className="typing" role="status" aria-label="Thinking">
              <i />
              <i />
              <i />
            </div>
            <p className="typecap">{slow ? "Still waiting for the model…" : "Reading the bill…"}</p>
          </>
        )}

        {status === "error" && (
          <div className="inerr" role="alert">
            <div className="mbox sm">
              <Mascot state="err" />
            </div>
            <div>
              <b>The model stopped responding</b>
              <p>{error ? `${error}. ` : ""}Your question is safe. Give it another go?</p>
              <Button onClick={() => onRetry(turn.id)}>Try again</Button>
            </div>
          </div>
        )}

        {status === "done" && answer && (
          <>
            <div className="tags">
              {answer.tags.map((tag) => (
                <Badge key={tag} tone={TAGS[tag].tone}>
                  {TAGS[tag].label}
                </Badge>
              ))}
            </div>
            <p className="t">
              {emphasisParts(answer.answer).map((part, i) => (part.strong ? <b key={i}>{part.text}</b> : part.text))}
            </p>
            {answer.calculation && <Calculation calc={answer.calculation} answerText={answer.answer} />}
            {answer.visual === "tax_breakdown" && <TaxBreakdown taxes={analysis.bill.taxes} />}
            {answer.visual === "history_chart" && (
              <HistoryChart history={analysis.history} threshold={thresholdFromQuestion(question)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
