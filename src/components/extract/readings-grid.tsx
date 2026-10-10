import { whole } from "@/lib/format";
import type { Bill } from "@/lib/bill/types";

const signed = (n: number | null) =>
  n == null ? "n/a" : n < 0 ? `−${whole(Math.abs(n))}` : whole(n);

export function ReadingsGrid({ bill }: { bill: Bill }) {
  const cells: [string, string][] = [
    ["Tariff", bill.tariff ?? "n/a"],
    ["Sanctioned load", bill.sanctioned_load_kw == null ? "n/a" : `${whole(bill.sanctioned_load_kw)} kW`],
    ["Previous reading", whole(bill.previous_reading)],
    ["Current reading", whole(bill.current_reading)],
    ["Reading date", bill.reading_date ?? "n/a"],
    ["Issue date", bill.issue_date ?? "n/a"],
    ["Due date", bill.due_date ?? "n/a"],
    ["Previous dues", signed(bill.arrears)],
  ];
  return (
    <div className="dl2">
      {cells.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}
