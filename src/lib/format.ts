import type { Bill } from "@/lib/bill/schema";

/** Display helpers shared by the UI. Pure functions, no I/O. */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PROVIDER_LABEL ={ KE: "K-Electric", LESCO: "LESCO", IESCO: "IESCO" } as const;

/** 2860.62 -> "2,860.62"; null -> "n/a". Always two decimals (table style). */
export function fixed2(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 3430 -> "3,430"; 3430.24 -> "3,430.24"; null -> "n/a". Decimals only when present. */
export function whole(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "2026-04" -> "April 2026" (null when the value is not a valid month). */
export function monthLabel(value: string | null): string | null {
  const m = value && /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** "2026-04-21" -> "21 April 2026" (null when the value is not a valid date). */
export function longDate(value: string | null): string | null {
  const m = value && /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** Whether the printed lines add up to the printed subtotal (within PKR 1). Null when it can't be checked. */
export function linesAddUp(items: { amount: number }[], printedTotal: number | null): boolean | null {
  if (printedTotal == null || !items.length) return null;
  return Math.abs(items.reduce((s, i) => s + i.amount, 0) - printedTotal) <= 1;
}

/** Extra paid when the bill is settled after the due date, or null if either amount is missing. */
export function lateExtra(bill: Bill): number | null {
  if (bill.payable_after_due_date == null || bill.payable_within_due_date == null) return null;
  return Math.round((bill.payable_after_due_date - bill.payable_within_due_date) * 100) / 100;
}

/** Splits text so amounts and percentages can be emphasised without injecting HTML. */
export function emphasisParts(text: string): { text: string; strong: boolean }[] {
  // With one capture group, split() puts the matches at odd indices.
  return text
    .split(/(PKR\s?-?[\d,]+(?:\.\d+)?|-?\d[\d,]*(?:\.\d+)?%)/g)
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((p) => p.text);
}

const KB = 1024;
export const fileSizeLabel = (bytes: number) => `${Math.max(1, Math.round(bytes / KB))} KB`;
