import { fixed2 } from "@/lib/format";
import { labelFor } from "@/lib/labels";

type Item = { type: string; amount: number };

/** Itemised lines with proportional bars, then the printed subtotal. Bars scale to the largest line. */
export function LineItems({
  items,
  labels,
  totalLabel,
  total,
}: {
  items: Item[];
  labels: Record<string, string>;
  totalLabel: string;
  total: number | null;
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.amount)));
  // Worked example for the caption: the first line that is not the largest one.
  const example = items.find((i) => Math.abs(i.amount) < max);
  return (
    <div className="rows">
      {items.length > 1 && (
        <p className="rows-note">
          Bar length compares each line with the largest line in this list ({fixed2(max)} = full bar)
          {example && (
            <>
              . Example: {fixed2(Math.abs(example.amount))} ÷ {fixed2(max)} ≈{" "}
              {Math.round((Math.abs(example.amount) / max) * 100)}% of the bar
            </>
          )}
          . Negative lines are drawn by size only.
        </p>
      )}
      {items.length === 0 && (
        <div className="row">
          <span>No separate lines were printed.</span>
        </div>
      )}
      {items.map((item, i) => (
        <div className="row" key={`${item.type}-${i}`}>
          <span>
            {labelFor(labels, item.type)}
            <code>{item.type}</code>
          </span>
          <span className="a">{fixed2(item.amount)}</span>
          <div className="bar2">
            <i style={{ width: `${(Math.abs(item.amount) / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="row tot">
        <span>{totalLabel}</span>
        <span className="a">{total == null ? "n/a" : fixed2(total)}</span>
      </div>
    </div>
  );
}
