import { describe, expect, it } from "vitest";
import { findInconsistencies, normalizeBill, type Bill } from "@/lib/bill/schema";

/** Made-up numbers shaped like the IESCO/LESCO summary block: Net = Total - Subsidies, FPA billed on top. */
const summaryBlock: Bill = {
  provider: "LESCO", tariff: "A-1A(01)", sanctioned_load_kw: 3, bill_month: "2026-09", reading_date: null,
  issue_date: null, due_date: null, previous_reading: 100, current_reading: 300, units_consumed: 200,
  charges: [
    { type: "energy", amount: 1000 },
    { type: "subsidy", amount: -200 },
    { type: "fpa", amount: 50 },
  ],
  total_charges: 800, // "Net Electricity Charges": energy minus subsidy, excludes FPA
  taxes: [],
  total_taxes: 150, // one combined tax amount
  current_bill: 950,
  arrears: 0,
  payable_within_due_date: 1000, // Grand Total = current bill + FPA
  payable_after_due_date: 1100,
};

describe("summary-block layout (fuel adjustment billed on top of the subtotal)", () => {
  it("is not flagged when the lines add up to the subtotal with or without the FPA line", () => {
    expect(findInconsistencies(summaryBlock)).toEqual([]);
  });

  it("is still flagged when neither sum matches the printed subtotal", () => {
    const wrong = { ...summaryBlock, total_charges: 123 };
    expect(findInconsistencies(wrong).join(" ")).toMatch(/charge lines add up/);
  });

  it("accepts charges + taxes equal to payable minus arrears when the current bill excludes FPA", () => {
    const bill = { ...summaryBlock, total_charges: 800, total_taxes: 200, current_bill: 900, payable_within_due_date: 1000, arrears: 0 };
    expect(findInconsistencies(bill)).toEqual([]);
    expect(findInconsistencies({ ...bill, payable_within_due_date: 5000 }).join(" ")).toMatch(/is not the current bill/);
  });
});

describe("subsidies are always deductions (guide 5.4.1)", () => {
  it("flips a positive subsidy to negative and leaves other lines alone", () => {
    const bill = normalizeBill({
      ...summaryBlock,
      charges: [
        { type: "energy", amount: 1000 },
        { type: "subsidy", amount: 200 },
        { type: "fpa", amount: 50 },
      ],
    });
    expect(bill.charges).toEqual([
      { type: "energy", amount: 1000 },
      { type: "subsidy", amount: -200 },
      { type: "fpa", amount: 50 },
    ]);
  });

  it("keeps an already negative subsidy and drops a zero one", () => {
    const bill = normalizeBill({
      ...summaryBlock,
      charges: [{ type: "subsidy", amount: -200 }, { type: "subsidy", amount: 0 }],
    });
    expect(bill.charges).toEqual([{ type: "subsidy", amount: -200 }]);
  });
});
