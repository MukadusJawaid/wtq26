import type { ReactNode } from "react";
import { Card } from "./card";
import { Mascot } from "./mascot";

/** Friendly placeholder for steps that need a decoded bill first. */
export function EmptyState({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <Card className="empty-state">
      <div className="mbox">
        <Mascot state="idle" />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </Card>
  );
}
