import { monthLabel } from "../format";
import type { Bill, History } from "./schema";

/**
 * Trend and "what if" figures for the Level 2 questions (highest month, same month
 * last year, summer vs winter, payments, 3-month direction, next-month estimates,
 * spreading the cost, "same units as last month"). Everything here is plain code
 * over the numbers read from the bill; the model only phrases the results.
 */

type Point = { month: string; units: number | null; billed: number | null; paid: number | null };
type UnitPoint = Point & { units: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => r2(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = (n: number) => `PKR ${r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (m: string) => monthLabel(m) ?? m;
const signed = (n: number) => (r2(n) > 0 ? `+${num(n)}` : num(n));
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const monthNo = (m: string) => Number(m.slice(5, 7));
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + monthNo(m) - 1;
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const hasUnits = (p: Point): p is UnitPoint => p.units != null;

/** Months printed on the bill strictly before the bill month, oldest first, one entry per month. */
export function pastMonths(bill: Bill, history: History): Point[] {
  const byMonth = new Map<string, Point>();
  for (const h of history) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(h.month)) {
      byMonth.set(h.month, { month: h.month, units: h.units, billed: h.amount, paid: h.payment });
    }
  }
  let points = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (bill.bill_month) points = points.filter((p) => p.month < bill.bill_month!);
  return points;
}

/** Ordinary least squares over (month index, units); returns the value predicted at `at`. */
export function linearProjection(points: { index: number; units: number }[], at: number) {
  const n = points.length;
  const mx = sum(points.map((p) => p.index)) / n;
  const my = sum(points.map((p) => p.units)) / n;
  const sxx = sum(points.map((p) => (p.index - mx) ** 2));
  const slope = sxx === 0 ? 0 : sum(points.map((p) => (p.index - mx) * (p.units - my))) / sxx;
  return { slope, predicted: my + slope * (at - mx) };
}

const direction = (net: number) => (r2(net) > 0 ? "up" : r2(net) < 0 ? "down" : "unchanged");

export function questionFacts(bill: Bill, history: History): string[] {
  const facts: string[] = [];
  const points = pastMonths(bill, history);
  const withUnits = points.filter(hasUnits);
  const cur = bill.units_consumed;
  const curMonth = bill.bill_month;
  const curLabel = curMonth ? label(curMonth) : "this month";

  if (!points.length) return facts;

  // Q2: highest / lowest month
  if (withUnits.length) {
    const max = Math.max(...withUnits.map((p) => p.units));
    const min = Math.min(...withUnits.map((p) => p.units));
    const top = withUnits.filter((p) => p.units === max).map((p) => label(p.month));
    const bottom = withUnits.filter((p) => p.units === min).map((p) => label(p.month));
    facts.push(`Highest units in the ${withUnits.length} previous months shown: ${top.join(" and ")} (${num(max)} units). Lowest: ${bottom.join(" and ")} (${num(min)} units).`);
    if (cur != null) {
      facts.push(`This month (${curLabel}, ${num(cur)} units) is ${cur > max ? "higher than" : cur === max ? "equal to" : "lower than"} the highest previous month.`);
    }
  }

  // Q5: same month last year
  if (curMonth && cur != null) {
    const lastYear = `${Number(curMonth.slice(0, 4)) - 1}-${curMonth.slice(5, 7)}`;
    const prior = points.find((p) => p.month === lastYear && p.units != null);
    if (prior?.units != null) {
      const diff = cur - prior.units;
      const pct = prior.units ? ` (${signed((diff / prior.units) * 100)}%)` : "";
      facts.push(`Same month last year (${label(lastYear)}): ${num(prior.units)} units. This month: ${num(cur)} units. Difference ${signed(diff)} units${pct}, so consumption is ${direction(diff)} compared with a year ago.`);
    } else {
      facts.push(`The same month last year (${label(lastYear)}) is not shown on this bill, so a year-on-year comparison is not possible.`);
    }
  }

  // Q7: summer (Jun-Aug) vs winter (Dec-Feb)
  const season = (months: number[]) => withUnits.filter((p) => months.includes(monthNo(p.month)));
  const summer = season([6, 7, 8]);
  const winter = season([12, 1, 2]);
  const list = (ps: UnitPoint[]) => ps.map((p) => `${label(p.month)} ${num(p.units)}`).join(", ");
  if (summer.length && winter.length) {
    const sTotal = sum(summer.map((p) => p.units));
    const wTotal = sum(winter.map((p) => p.units));
    const sAvg = sTotal / summer.length;
    const wAvg = wTotal / winter.length;
    facts.push(`Summer (June-August) months on the bill: ${list(summer)}; total ${num(sTotal)}, average ${num(sAvg)} per month.`);
    facts.push(`Winter (December-February) months on the bill: ${list(winter)}; total ${num(wTotal)}, average ${num(wAvg)} per month.`);
    facts.push(`Summer minus winter: ${signed(sTotal - wTotal)} units in total (${summer.length} summer vs ${winter.length} winter months), or ${signed(sAvg - wAvg)} units per month on average.`);
  } else {
    facts.push("The history on this bill does not include both summer (June-August) and winter (December-February) months, so that comparison is incomplete.");
  }

  // Q8: payments
  const billed = points.filter((p) => p.billed != null);
  if (billed.length) {
    const paidFull = billed.filter((p) => p.paid != null && p.paid >= p.billed! - 1);
    const under = billed.filter((p) => p.paid != null && p.paid < p.billed! - 1);
    const none = billed.filter((p) => p.paid == null);
    facts.push(`Billing history shows a billed amount for ${billed.length} of the ${points.length} previous months. Paid in full: ${paidFull.length}. Paid less than billed: ${under.length}${under.length ? " (" + under.map((p) => `${label(p.month)} billed ${num(p.billed!)}, paid ${num(p.paid!)}`).join("; ") + ")" : ""}. No payment shown: ${none.length}${none.length ? " (" + none.map((p) => label(p.month)).join(", ") + ")" : ""}.`);
    if (billed.length < 12) facts.push(`Payment information covers only ${billed.length} month(s) on this bill, not a full 12 months.`);
  } else {
    facts.push("The bill does not show monthly payments, so payment behaviour cannot be checked.");
  }

  // Q9: direction over the last three months
  if (withUnits.length >= 3) {
    const last3 = withUnits.slice(-3);
    const steps = last3.slice(1).map((p, i) => p.units - last3[i].units);
    const net = last3[2].units - last3[0].units;
    facts.push(`Last 3 previous months: ${last3.map((p) => `${label(p.month)} ${num(p.units)}`).join(" → ")} (changes ${steps.map(signed).join(", ")}; net ${signed(net)}, ${direction(net)}).`);
    if (cur != null && curMonth) {
      const two = withUnits.slice(-2);
      const seq = [...two.map((p) => p.units), cur];
      const s2 = seq.slice(1).map((u, i) => u - seq[i]);
      const n2 = seq[2] - seq[0];
      facts.push(`Including this month: ${two.map((p) => `${label(p.month)} ${num(p.units)}`).join(" → ")} → ${curLabel} ${num(cur)} (changes ${s2.map(signed).join(", ")}; net ${signed(n2)}, ${direction(n2)}).`);
    }
  }

  // Q10: next month's units (estimates)
  if (curMonth && cur != null && withUnits.length >= 3) {
    const series = [...withUnits.map((p) => ({ index: monthIndex(p.month), units: p.units })), { index: monthIndex(curMonth), units: cur }];
    const nextIdx = monthIndex(curMonth) + 1;
    const next = fromIndex(nextIdx);
    const { slope, predicted } = linearProjection(series, nextIdx);
    const avg = sum(withUnits.map((p) => p.units)) / withUnits.length;
    const avg3 = sum(withUnits.slice(-3).map((p) => p.units)) / Math.min(3, withUnits.length);
    const yearAgo = withUnits.find((p) => p.month === fromIndex(nextIdx - 12));
    facts.push(
      `ESTIMATES for ${label(next)} units: linear trend over ${series.length} months (${slope >= 0 ? "rising" : "falling"} by ${num(Math.abs(slope))} units per month) projects about ${num(Math.max(0, predicted))}; average of the ${withUnits.length} previous months is ${num(avg)}; average of the last 3 previous months is ${num(avg3)}${yearAgo ? `; the same month a year earlier (${label(yearAgo.month)}) was ${num(yearAgo.units)}` : ""}.`,
    );
  }

  // Q11: spreading the cost across the year
  if (billed.length) {
    const total = sum(billed.map((p) => p.billed!));
    const avg = total / billed.length;
    facts.push(`Billed amounts shown for ${billed.length} previous month(s) total ${money(total)}, an average of ${money(avg)} per month (about ${money(avg * 12)} per year at that rate).`);
    if (bill.current_bill != null) {
      const withCurrent = (total + bill.current_bill) / (billed.length + 1);
      facts.push(`Including the current bill (${money(bill.current_bill)}), the average over ${billed.length + 1} months is ${money(withCurrent)} per month.`);
    }
  } else if (bill.current_bill != null) {
    facts.push(`Previous bill amounts are not shown; the only amount available is the current bill of ${money(bill.current_bill)}.`);
  }

  // Q12: same units as last month
  const lastMonth = withUnits.at(-1);
  if (lastMonth && cur && bill.current_bill != null) {
    const perUnit = bill.current_bill / cur;
    facts.push(`ESTIMATE: last month (${label(lastMonth.month)}) used ${num(lastMonth.units)} units. At this month's average all-in cost of ${money(perUnit)} per unit (current bill ${money(bill.current_bill)} ÷ ${num(cur)} units, fixed charges and taxes included), the same units would cost roughly ${money(lastMonth.units * perUnit)}.`);
  }

  return facts;
}
