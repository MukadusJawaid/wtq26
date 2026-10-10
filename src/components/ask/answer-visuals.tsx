import { fixed2 } from "@/lib/format";
import { TAX_LABELS, labelFor } from "@/lib/labels";
import type { Analysis } from "@/lib/bill/types";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHART_HEIGHT = 140;

/** Each tax line as a share of the taxes printed on the bill. */
export function TaxBreakdown({ taxes }: { taxes: Analysis["bill"]["taxes"] }) {
  const total = taxes.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (!taxes.length || !total) return null;
  return (
    <div className="mini">
      {taxes.map((t, i) => (
        <div className="r" key={`${t.type}-${i}`}>
          <span>{labelFor(TAX_LABELS, t.type)}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(Math.abs(t.amount) / total) * 100}%` }} />
          </div>
          <span className="mono" style={{ color: "var(--ink)", direction: "ltr" }}>
            {fixed2(t.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A "200 units" style number mentioned in the question becomes the highlighted threshold. */
export function thresholdFromQuestion(question: string): number | null {
  const m = /(\d[\d,]*)\s*units?/i.exec(question);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** Monthly consumption bars read from the bill; months above the threshold are highlighted. */
export function HistoryChart({ history, threshold }: { history: Analysis["history"]; threshold: number | null }) {
  const points = history
    .filter((h): h is typeof h & { units: number } => h.units != null)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.units), threshold ?? 0);
  const label = (month: string) => MONTH_ABBR[Number(month.slice(5, 7)) - 1] ?? month;

  return (
    <div>
      <div className="bars">
        {threshold != null && (
          <div className="line" data-l={`${threshold} units`} style={{ bottom: Math.round((threshold / max) * CHART_HEIGHT) }} />
        )}
        {points.map((p, i) => (
          <div className="b" key={p.month}>
            <span>{p.units}</span>
            <i
              className={threshold != null && p.units > threshold ? "hi" : ""}
              style={{ height: Math.round((p.units / max) * CHART_HEIGHT), animationDelay: `${i * 40}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="months">
        {points.map((p) => (
          <span key={p.month}>{label(p.month)}</span>
        ))}
      </div>
    </div>
  );
}
