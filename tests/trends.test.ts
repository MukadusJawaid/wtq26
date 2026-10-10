import { describe, expect, it } from "vitest";
import type { Bill, History } from "@/lib/bill/schema";
import { linearProjection, pastMonths, questionFacts } from "@/lib/bill/trends";

/**
 * A made-up household (not taken from any real bill): consumption rises by 10 units a month
 * from September 2025 (100) to August 2026 (210). Current month, September 2026, used 150.
 * Every expected figure below can be checked by hand.
 */
const MONTHS = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

const history: History = MONTHS.map((month, i) => {
  const units = 100 + i * 10;
  const billed = units * 10;
  // December 2025: nothing paid. March 2026: paid 100 less than billed.
  const payment = month === "2025-12" ? null : month === "2026-03" ? billed - 100 : billed;
  return { month, units, amount: billed, payment };
});

const bill = {
  provider: "KE", tariff: "T", sanctioned_load_kw: 3, bill_month: "2026-09", reading_date: null, issue_date: null,
  due_date: null, previous_reading: null, current_reading: null, units_consumed: 150, charges: [], total_charges: null,
  taxes: [], total_taxes: null, current_bill: 1500, arrears: null, payable_within_due_date: null, payable_after_due_date: null,
} as Bill;

const facts = questionFacts(bill, history).join("\n");

describe("questionFacts", () => {
  it("Q2 highest and lowest month", () => {
    expect(facts).toContain("Highest units in the 12 previous months shown: August 2026 (210 units). Lowest: September 2025 (100 units).");
    expect(facts).toContain("This month (September 2026, 150 units) is lower than the highest previous month.");
  });

  it("Q5 same month last year", () => {
    expect(facts).toContain("Same month last year (September 2025): 100 units. This month: 150 units. Difference +50 units (+50%)");
  });

  it("Q7 summer versus winter", () => {
    expect(facts).toContain("total 600, average 200 per month"); // Jun 190 + Jul 200 + Aug 210
    expect(facts).toContain("total 420, average 140 per month"); // Dec 130 + Jan 140 + Feb 150
    expect(facts).toContain("Summer minus winter: +180 units in total (3 summer vs 3 winter months), or +60 units per month on average.");
  });

  it("Q8 payments: full, short and missing", () => {
    expect(facts).toContain("Paid in full: 10");
    expect(facts).toContain("Paid less than billed: 1 (March 2026 billed 1,600, paid 1,500)");
    expect(facts).toContain("No payment shown: 1 (December 2025)");
  });

  it("Q9 last three months, with and without the current month", () => {
    expect(facts).toContain("June 2026 190 → July 2026 200 → August 2026 210 (changes +10, +10; net +20, up)");
    expect(facts).toContain("July 2026 200 → August 2026 210 → September 2026 150 (changes +10, -60; net -50, down)");
  });

  it("Q10 next-month estimates are labelled and match the hand calculation", () => {
    expect(facts).toContain("ESTIMATES for October 2026 units");
    expect(facts).toContain("projects about 208.46"); // least squares over 13 points, see below
    expect(facts).toContain("average of the 12 previous months is 155");
    expect(facts).toContain("average of the last 3 previous months is 200");
    expect(facts).toContain("the same month a year earlier (October 2025) was 110");
  });

  it("Q11 spreading the cost over the year", () => {
    expect(facts).toContain("total PKR 18,600.00, an average of PKR 1,550.00 per month (about PKR 18,600.00 per year");
    expect(facts).toContain("average over 13 months is PKR 1,546.15 per month");
  });

  it("Q12 same units as last month", () => {
    expect(facts).toContain("last month (August 2026) used 210 units");
    expect(facts).toContain("roughly PKR 2,100.00"); // 210 units x PKR 10 per unit
  });

  it("says so when the history cannot support a comparison", () => {
    const short = questionFacts(bill, history.filter((h) => h.month >= "2026-06")).join("\n");
    expect(short).toContain("does not include both summer");
    expect(short).toContain("year-on-year comparison is not possible");
    expect(questionFacts(bill, [])).toEqual([]);
  });
});

describe("helpers", () => {
  it("linearProjection fits a straight line exactly", () => {
    const { slope, predicted } = linearProjection([0, 1, 2, 3].map((i) => ({ index: i, units: 5 + 2 * i })), 4);
    expect(slope).toBeCloseTo(2);
    expect(predicted).toBeCloseTo(13);
  });

  it("pastMonths keeps only months before the bill month, once each, oldest first", () => {
    const messy: History = [
      { month: "2026-08", units: 5, amount: null, payment: null },
      { month: "2026-09", units: 99, amount: null, payment: null }, // the bill's own month: excluded
      { month: "2026-07", units: 4, amount: null, payment: null },
      { month: "2026-08", units: 6, amount: null, payment: null }, // duplicate month: last one wins
      { month: "bad", units: 1, amount: null, payment: null },
    ];
    expect(pastMonths(bill, messy).map((p) => [p.month, p.units])).toEqual([["2026-07", 4], ["2026-08", 6]]);
  });
});
