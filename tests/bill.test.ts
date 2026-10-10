import { describe, expect, it } from "vitest";
import { computeFacts } from "@/lib/bill/facts";
import { findInconsistencies, fromModelOutput, normalizeBill, type Bill } from "@/lib/bill/schema";
import { lateExtra, linesAddUp, longDate, monthLabel, whole } from "@/lib/format";

/** The structure of the guide's KESC_0008 example: only used to test arithmetic, never at runtime. */
const bill: Bill = {
  provider: "KE",
  tariff: "A1-R",
  sanctioned_load_kw: 3,
  bill_month: "2026-04",
  reading_date: "2026-04-03",
  issue_date: "2026-04-07",
  due_date: "2026-04-21",
  previous_reading: 8819,
  current_reading: 8970,
  units_consumed: 151,
  charges: [
    { type: "fixed", amount: 900 },
    { type: "energy", amount: 1054 },
    { type: "energy", amount: 663.51 },
    { type: "quarterly_adjustment", amount: 52.91 },
    { type: "fpa", amount: 125.27 },
    { type: "surcharge", amount: 64.93 },
  ],
  total_charges: 2860.62,
  taxes: [
    { type: "electricity_duty", amount: 29.41 },
    { type: "gst", amount: 520.21 },
    { type: "municipal_tax", amount: 20 },
  ],
  total_taxes: 569.62,
  current_bill: 3430.24,
  arrears: -0.53,
  payable_within_due_date: 3430,
  payable_after_due_date: 3716,
};

describe("consistency checks", () => {
  it("passes a correctly read bill", () => {
    expect(findInconsistencies(bill)).toEqual([]);
    expect(linesAddUp(bill.charges, bill.total_charges)).toBe(true);
    expect(linesAddUp(bill.taxes, bill.total_taxes)).toBe(true);
  });
  it("flags a misread charge line", () => {
    const wrong = { ...bill, charges: bill.charges.map((c, i) => (i === 0 ? { ...c, amount: 150 } : c)) };
    expect(findInconsistencies(wrong).join(" ")).toMatch(/charge lines add up/);
    expect(linesAddUp(wrong.charges, wrong.total_charges)).toBe(false);
  });
  it("flags readings that do not match units", () => {
    expect(findInconsistencies({ ...bill, previous_reading: 3319 }).join(" ")).toMatch(/Readings differ/);
  });
  it("cannot check what is not printed", () => {
    expect(linesAddUp(bill.charges, null)).toBeNull();
    expect(linesAddUp([], 10)).toBeNull();
  });
});

describe("model output handling", () => {
  const raw = { ...bill, supported_bill: true, late_payment_amounts: [3574, 3716] };
  it("always takes the highest late-payment amount, whatever the model picked", () => {
    expect(fromModelOutput({ ...raw, payable_after_due_date: 3574 }).bill.payable_after_due_date).toBe(3716);
  });
  it("marks an empty reading as unsupported even if the model said otherwise", () => {
    const empty = {
      ...raw,
      provider: null,
      current_bill: null,
      units_consumed: null,
    } as unknown as Parameters<typeof fromModelOutput>[0];
    expect(fromModelOutput(empty).supported).toBe(false);
  });
  it("respects the model's rejection", () => {
    expect(fromModelOutput({ ...raw, supported_bill: false }).supported).toBe(false);
  });
  it("normalises formats the model may get wrong", () => {
    const messy = normalizeBill({ ...bill, due_date: "21/04/2026", bill_month: "April", total_taxes: 569.6200001 });
    expect(messy.due_date).toBeNull();
    expect(messy.bill_month).toBeNull();
    expect(messy.total_taxes).toBe(569.62);
  });
  it("drops zero-amount lines", () => {
    expect(normalizeBill({ ...bill, charges: [...bill.charges, { type: "other", amount: 0 }] }).charges).toHaveLength(6);
  });
});

describe("facts computed in code", () => {
  const history = [
    { month: "2025-07", units: 239, amount: null, payment: null },
    { month: "2025-08", units: 203, amount: null, payment: null },
    { month: "2025-09", units: 176, amount: null, payment: null },
    { month: "2025-10", units: 173, amount: null, payment: null },
  ];
  const facts = computeFacts(bill, history).join("\n");

  it("tax share of the bill", () => {
    expect(facts).toContain("16.61% of the current bill");
  });
  it("late surcharge", () => {
    expect(facts).toContain("PKR 286.00");
  });
  it("counts of months above thresholds", () => {
    expect(facts).toContain("above 200 units: 2 of 4");
    expect(facts).toContain("above 100 units: 4 of 4");
  });
  it("history average and comparison with this month", () => {
    expect(facts).toContain("History average 197.75");
    expect(facts).toContain("below the history average");
  });
});

describe("display helpers", () => {
  it("formats dates, months and amounts", () => {
    expect(longDate("2026-04-21")).toBe("21 April 2026");
    expect(longDate("2026-13-01")).toBeNull();
    expect(monthLabel("2026-04")).toBe("April 2026");
    expect(whole(3430)).toBe("3,430");
    expect(whole(3430.24)).toBe("3,430.24");
    expect(whole(null)).toBe("n/a");
  });
  it("late extra", () => {
    expect(lateExtra(bill)).toBe(286);
    expect(lateExtra({ ...bill, payable_after_due_date: null })).toBeNull();
  });
});
