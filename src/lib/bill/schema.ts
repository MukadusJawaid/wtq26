import { z } from "zod";

/** Level 1 output schema (guide section 5.1). Every field is always present. */

export const CHARGE_TYPES = [
  "energy",
  "fixed",
  "fpa",
  "quarterly_adjustment",
  "surcharge",
  "meter_rent",
  "subsidy",
  "other",
] as const;

export const TAX_TYPES = [
  "gst",
  "electricity_duty",
  "income_tax",
  "municipal_tax",
  "other_tax",
] as const;

const amount = z.number().nullable();

export const billSchema = z.object({
  provider: z.enum(["KE", "LESCO", "IESCO"]).nullable(),
  tariff: z.string().nullable(),
  sanctioned_load_kw: amount,

  bill_month: z.string().nullable(),
  reading_date: z.string().nullable(),
  issue_date: z.string().nullable(),
  due_date: z.string().nullable(),

  previous_reading: amount,
  current_reading: amount,
  units_consumed: amount,

  charges: z.array(z.object({ type: z.enum(CHARGE_TYPES), amount: z.number() })),
  total_charges: amount,

  taxes: z.array(z.object({ type: z.enum(TAX_TYPES), amount: z.number() })),
  total_taxes: amount,

  current_bill: amount,
  arrears: amount,
  payable_within_due_date: amount,
  payable_after_due_date: amount,
});

export type Bill = z.infer<typeof billSchema>;

/**
 * What the model returns: the Level 1 object plus every late-payment amount it
 * can see. Code picks the highest, so the model never has to choose.
 */
export const modelBillSchema = billSchema.extend({
  /** True only for an electricity bill from K-Electric, LESCO or IESCO. */
  supported_bill: z.boolean(),
  late_payment_amounts: z.array(z.number()),
});

export function fromModelOutput(raw: z.infer<typeof modelBillSchema>): { bill: Bill; supported: boolean } {
  const { late_payment_amounts, supported_bill, ...fields } = raw;
  const candidates = [...late_payment_amounts];
  if (fields.payable_after_due_date != null) candidates.push(fields.payable_after_due_date);
  const bill = normalizeBill({
    ...fields,
    payable_after_due_date: candidates.length ? Math.max(...candidates) : null,
  });
  // The model's verdict is cross-checked: a "bill" with no provider and no amounts is not one.
  const looksEmpty = !bill.provider && bill.current_bill == null && bill.units_consumed == null;
  return { bill, supported: supported_bill && !looksEmpty };
}

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

/**
 * Cross-checks that a good reading should satisfy. These never change values;
 * they only tell us when to ask the model to look again.
 */
export function findInconsistencies(bill: Bill): string[] {
  const issues: string[] = [];
  const off = (a: number, b: number) => Math.abs(a - b) > 1;
  // On some layouts (IESCO/LESCO summary block) the fuel adjustment is billed on top of the subtotal,
  // so the lines may add up to the subtotal with or without the FPA line.
  const withoutFpa = sum(bill.charges.filter((c) => c.type !== "fpa"));
  if (
    bill.total_charges != null && bill.charges.length &&
    off(sum(bill.charges), bill.total_charges) && off(withoutFpa, bill.total_charges)
  ) {
    const gap = Math.round((withoutFpa - bill.total_charges) * 100) / 100;
    issues.push(
      `The charge lines add up to ${sum(bill.charges).toFixed(2)} but the printed charges subtotal is ${bill.total_charges}.` +
        (gap > 1
          ? ` Without the FPA line they are ${gap} too high, which usually means a printed row of about ${gap} (such as Subsidies) was left out. Look at the image for such a row; if it is printed, add it (a subsidy is a negative amount). Do not add anything that is not printed.`
          : ""),
    );
  }
  if (bill.total_taxes != null && bill.taxes.length && off(sum(bill.taxes), bill.total_taxes)) {
    issues.push(
      `The tax lines add up to ${sum(bill.taxes).toFixed(2)} but the printed taxes subtotal is ${bill.total_taxes}.`,
    );
  }
  // Charges + taxes equal the current bill, or (when the fuel adjustment is billed separately)
  // the amount payable minus arrears.
  const netPayable = bill.payable_within_due_date != null ? bill.payable_within_due_date - (bill.arrears ?? 0) : null;
  if (
    bill.total_charges != null && bill.total_taxes != null && bill.current_bill != null &&
    off(bill.total_charges + bill.total_taxes, bill.current_bill) &&
    (netPayable == null || off(bill.total_charges + bill.total_taxes, netPayable))
  ) {
    issues.push(
      `Charges subtotal (${bill.total_charges}) + taxes subtotal (${bill.total_taxes}) is not the current bill (${bill.current_bill}).`,
    );
  }
  if (
    bill.previous_reading != null && bill.current_reading != null && bill.units_consumed != null &&
    bill.units_consumed > 0 && bill.current_reading - bill.previous_reading > 0 &&
    Math.abs(bill.current_reading - bill.previous_reading - bill.units_consumed) > 1
  ) {
    issues.push(
      `Readings differ by ${(bill.current_reading - bill.previous_reading).toFixed(2)} but units consumed is ${bill.units_consumed} (this can be legitimate if a multiplier applies).`,
    );
  }
  return issues;
}

/** Monthly consumption history table printed on most bills (used by Level 2). */
export const historySchema = z.object({
  history: z.array(
    z.object({
      month: z.string().describe("YYYY-MM"),
      units: z.number().nullable(),
      /** Amount billed that month (BILL (RS.) / Billed Amount). */
      amount: z.number().nullable(),
      /** Amount paid that month (PAYMENT (RS.) / Payment); null when not printed. */
      payment: z.number().nullable(),
    }),
  ),
});

export type History = z.infer<typeof historySchema>["history"];

export const ANSWER_TAGS = ["bill", "calculated", "estimate", "not_on_bill"] as const;
export const ANSWER_VISUALS = ["none", "tax_breakdown", "history_chart"] as const;

const answerSchema = z.object({
  question_id: z.string(),
  answer: z.string().min(1),
  tags: z.array(z.enum(ANSWER_TAGS)),
  /** An arithmetic expression the app evaluates itself; the model never supplies the result. */
  calculation: z.object({ expression: z.string(), unit: z.enum(["pkr", "percent", "units", "none"]) }).nullable(),
  visual: z.enum(ANSWER_VISUALS),
});

export const answersSchema = z.object({ answers: z.array(answerSchema) });

/** One Level 2 answer. Only `answer` goes to level2.csv; the rest drives the UI. */
export type Answer = z.infer<typeof answerSchema>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** Enforces formats the model may get wrong; unusable values become null. */
export function normalizeBill(bill: Bill): Bill {
  const date = (v: string | null) => (v && DATE.test(v) ? v : null);
  const round = (v: number | null) =>
    v == null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000;
  return {
    ...bill,
    tariff: bill.tariff?.trim() || null,
    bill_month: bill.bill_month && MONTH.test(bill.bill_month) ? bill.bill_month : null,
    reading_date: date(bill.reading_date),
    issue_date: date(bill.issue_date),
    due_date: date(bill.due_date),
    sanctioned_load_kw: round(bill.sanctioned_load_kw),
    previous_reading: round(bill.previous_reading),
    current_reading: round(bill.current_reading),
    units_consumed: round(bill.units_consumed),
    total_charges: round(bill.total_charges),
    total_taxes: round(bill.total_taxes),
    current_bill: round(bill.current_bill),
    arrears: round(bill.arrears),
    payable_within_due_date: round(bill.payable_within_due_date),
    payable_after_due_date: round(bill.payable_after_due_date),
    // Subsidies are deductions (guide 5.4.1): always negative, however the model signed them.
    charges: bill.charges
      .filter((c) => c.amount !== 0)
      .map((c) => (c.type === "subsidy" && c.amount > 0 ? { ...c, amount: -c.amount } : c)),
    taxes: bill.taxes.filter((t) => t.amount !== 0),
  };
}
