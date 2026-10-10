/** Human-readable names for the machine types in the Level 1 schema. */

export const CHARGE_LABELS: Record<string, string> = {
  energy: "Energy charge",
  fixed: "Fixed charges",
  fpa: "Fuel price adjustment (FPA)",
  quarterly_adjustment: "Quarterly adjustment",
  surcharge: "Surcharge",
  meter_rent: "Meter rent",
  subsidy: "Subsidy",
  other: "Other charge",
};

export const TAX_LABELS: Record<string, string> = {
  gst: "Sales tax (GST)",
  electricity_duty: "Electricity duty",
  income_tax: "Income tax",
  municipal_tax: "Municipal tax",
  other_tax: "Other tax",
};

export const labelFor = (labels: Record<string, string>, type: string) => labels[type] ?? type;
