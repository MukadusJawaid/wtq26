import type { Bill, History } from "./schema";
import { questionFacts } from "./trends";

/**
 * Numbers for Level 2 are computed here, in code, from the extracted bill.
 * The model only gets to phrase them, so averages, shares and counts are exact.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => r2((part / whole) * 100);
const pkr = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function computeFacts(bill: Bill, history: History): string[] {
  const facts: string[] = [];
  const add = (s: string) => facts.push(s);

  if (bill.current_bill != null && bill.total_taxes != null && bill.current_bill !== 0) {
    add(
      `Taxes (printed subtotal) PKR ${pkr(bill.total_taxes)} = ${pct(bill.total_taxes, bill.current_bill)}% of the current bill PKR ${pkr(bill.current_bill)}.`,
    );
  }
  if (bill.current_bill != null && bill.total_charges != null && bill.current_bill !== 0) {
    add(
      `Charges (printed subtotal) PKR ${pkr(bill.total_charges)} = ${pct(bill.total_charges, bill.current_bill)}% of the current bill.`,
    );
  }
  if (bill.charges.length) {
    const byType = new Map<string, number>();
    for (const c of bill.charges) byType.set(c.type, (byType.get(c.type) ?? 0) + c.amount);
    add(
      "Charges by type: " +
        [...byType].map(([t, a]) => `${t} PKR ${pkr(a)}`).join("; ") +
        `. Sum of listed charge lines PKR ${pkr(bill.charges.reduce((s, c) => s + c.amount, 0))}.`,
    );
  }
  if (bill.taxes.length) {
    add(
      "Tax lines: " +
        bill.taxes.map((t) => `${t.type} PKR ${pkr(t.amount)}`).join("; ") +
        `. Sum of listed tax lines PKR ${pkr(bill.taxes.reduce((s, t) => s + t.amount, 0))}.`,
    );
  }
  if (bill.current_bill != null && bill.units_consumed) {
    add(
      `Average cost per unit this month (current bill / units) = PKR ${pkr(bill.current_bill / bill.units_consumed)} for ${bill.units_consumed} units (estimate, includes taxes and fixed charges).`,
    );
  }
  if (bill.charges.length && bill.units_consumed) {
    const energy = bill.charges.filter((c) => c.type === "energy");
    if (energy.length) {
      const sum = energy.reduce((s, c) => s + c.amount, 0);
      add(`Energy charge lines total PKR ${pkr(sum)}, about PKR ${pkr(sum / bill.units_consumed)} per unit.`);
    }
  }
  if (bill.previous_reading != null && bill.current_reading != null) {
    add(
      `Reading difference = ${r2(bill.current_reading - bill.previous_reading)} (current ${bill.current_reading} - previous ${bill.previous_reading}); printed units consumed = ${bill.units_consumed ?? "not printed"}.`,
    );
  }
  if (bill.payable_after_due_date != null && bill.payable_within_due_date != null) {
    const diff = r2(bill.payable_after_due_date - bill.payable_within_due_date);
    add(
      `Late payment surcharge = payable after due date PKR ${pkr(bill.payable_after_due_date)} - payable within due date PKR ${pkr(bill.payable_within_due_date)} = PKR ${pkr(diff)}` +
        (bill.payable_within_due_date
          ? ` (${pct(diff, bill.payable_within_due_date)}% extra).`
          : "."),
    );
  }
  if (bill.arrears != null) {
    add(`Arrears (previous dues, printed sign): PKR ${pkr(bill.arrears)}.`);
  }

  const known = history.filter((h): h is typeof h & { units: number } => h.units != null);
  if (known.length) {
    const units = known.map((h) => h.units);
    const avg = units.reduce((s, u) => s + u, 0) / units.length;
    const max = known.reduce((a, b) => (b.units > a.units ? b : a));
    const min = known.reduce((a, b) => (b.units < a.units ? b : a));
    add(
      `History (${history.length} previous months): ` + history.map((h) => `${h.month}: ${h.units ?? "?"} units`).join(", ") + ".",
    );
    add(`History average ${r2(avg)} units/month; highest ${max.month} (${max.units}); lowest ${min.month} (${min.units}).`);
    for (const t of [100, 200, 300, 400, 500, 600]) {
      add(`Previous months above ${t} units: ${units.filter((u) => u > t).length} of ${units.length}.`);
    }
    if (bill.units_consumed != null) {
      add(
        `Current month ${bill.units_consumed} units is ${r2(bill.units_consumed - avg)} units ${bill.units_consumed >= avg ? "above" : "below"} the history average (${pct(bill.units_consumed - avg, avg)}%).`,
      );
      const withCurrent = [...units, bill.units_consumed];
      add(`Average including current month: ${r2(withCurrent.reduce((s, u) => s + u, 0) / withCurrent.length)} units.`);
    }
  } else {
    add("No monthly consumption history could be read from this bill.");
  }
  facts.push(...questionFacts(bill, history));
  return facts;
}
