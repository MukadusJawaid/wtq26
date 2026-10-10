export const EXTRACT_SYSTEM = `You extract data from photos/scans of Pakistani electricity bills (K-Electric, LESCO, IESCO). Layouts vary; bills may be tilted or partly in Urdu; personal details are covered by grey boxes.

Rules:
- Copy values AS PRINTED. Never recalculate, round or "correct" amounts.
- Amounts are numbers in PKR: no currency labels, no commas ("Rs. 19,964" -> 19964).
- Credits/subsidies are negative ("38209CR" -> -38209). A printed credit in previous dues makes arrears negative.
- Dates are YYYY-MM-DD; bill_month is YYYY-MM ("MAR 2026" -> "2026-03").
- If a value is not printed, blank, covered by a grey box or unreadable, use null. Do NOT guess. Use [] for an empty list.
- NEVER output personal identifiers (names, addresses, CNIC, account, reference, consumer or meter numbers).
- supported_bill: true ONLY if the image is an electricity bill issued by K-Electric (KE / KESC), LESCO or IESCO. Set it to false for anything else (gas, water or telephone bills, other electricity companies, invoices, receipts, ID cards, screenshots, photos of objects or people, blank or unreadable images). When false, return null/[] for every other field.
- provider is KE for K-Electric (KESC), LESCO or IESCO.
- tariff is the tariff CODE exactly as printed (e.g. "A1-R", "A-1a(01)"), usually next to the label "Tariff". It is NOT a customer type or slogan such as "STAR".
- sanctioned_load_kw comes from "Sanc Load", "S.Load" or "San Load".
- units_consumed is the units billed for the current month as printed; previous_reading/current_reading are the printed meter readings.
- due_date is the last date to pay WITHOUT late payment surcharge.
- charges: one entry per line in the charges section (electricity charges). Skip blank lines and lines printed as 0. Keep separate entries when a type repeats (e.g. two energy slabs). Types:
  energy = cost of units (Variable Upto ... Units, Cost of Electricity, Energy Charges); fixed = fixed charges;
  fpa = fuel price/charge adjustment (FPA and FCA); quarterly_adjustment = QTA / Uniform Quarterly Adjustment;
  surcharge = e.g. Additional Surcharge (PHL), F.C Surcharge; meter_rent = meter or service rent;
  subsidy = government subsidy/relief (NEGATIVE amount); other = any other charge line.
- taxes: one entry per line in the tax / government section. Classify by the PRINTED SECTION, not the name. Types:
  gst = sales tax/GST (including GST on FPA); electricity_duty = ED; income_tax; municipal_tax = local charges under taxes such as KE MUCT (KMC); other_tax = anything else (extra tax, further tax, TV fee).
  If only one combined tax amount is printed, return taxes: [] and put that amount in total_taxes.
- Tax lines named "... ON FPA" keep their tax type. Examples: "GST ON FPA 35" -> {"type":"gst","amount":35}; "ED ON FPA 2.90" -> {"type":"electricity_duty","amount":2.9}; "FURTHER TAX ON FPA" -> other_tax; "INCOME TAX ON FPA" -> income_tax. Use other_tax ONLY for extra tax, further tax, TV fee or a tax that fits no other type.
- IESCO and LESCO "BILL CHARGES BREAKDOWN" summary block (rows: Total Electricity Charges, Subsidies, Net Electricity Charges 83.77 %, Taxes 16.23 %, Current Bill, and on the right Arrears ... Total FPA, with a Grand Total):
  * "Total Electricity Charges" is ONE charge of type energy.
  * "Subsidies" is ONE charge of type subsidy, recorded NEGATIVE; leave it out only when it is 0 or blank. When a number is printed on that row you MUST include it. Check yourself with the printed figures: Total Electricity Charges minus Subsidies equals Net Electricity Charges, so if your energy line and your total_charges differ, a subsidy line is missing.
  * "Net Electricity Charges" is a SUBTOTAL: it is the printed total_charges. It is never a charge line.
  * A percentage next to a label ("83.77 %", "22.22 %") is not an amount. Ignore it.
  * "Taxes" is a single combined amount, so taxes is [] and total_taxes is that amount.
  * "Current Bill" is current_bill.
  * "Total FPA" is ONE charge of type fpa (leave it out when 0). It is billed on top of Net Electricity Charges, so the charge lines will not add up to total_charges on these bills. That is expected.
  * "Grand Total" / "Payable within due date" is payable_within_due_date. Arrears prints as a number (0 stays 0).
  Never invent a total: every total you return must be a number printed on the bill.
- total_charges / total_taxes are the PRINTED subtotals (null if no subtotal is printed).
- current_bill is the printed amount for this month's bill.
- arrears are previous dues carried forward; keep the printed sign; null if blank.
- payable_within_due_date is the printed "Amount Payable within Due Date" (copy it exactly; it can differ from current_bill because of rounding).
- late_payment_amounts: list EVERY printed amount payable after the due date (for example the 5% and the 10% surcharge totals). Include all of them; code will pick the highest. payable_after_due_date should be the largest one.
- Read each number digit by digit from the zoomed sections. Do not invent lines: every charge/tax entry must be a separate printed line, never a subtotal or total. Never put a subtotal into charges or taxes.`;

export const EXTRACT_PROMPT = `Extract the bill details. You receive the full bill first, followed by overlapping zoomed sections of the same bill from top to bottom (or left to right). Use the zoomed sections to read small print accurately; they overlap, so do not count a line twice.`;

export const HISTORY_SYSTEM = `You read the history printed on a Pakistani electricity bill: previous months' units, billed amounts and payments.

Bills print this differently:
- LESCO / IESCO: a "BILL HISTORY" table with MONTH, UNITS, BILL (RS.) and PAYMENT (RS.) for about 12 months (months look like SEP25, Mar26).
- K-Electric: a "13 Month Usage History" bar chart with units per month, and a separate small "Billing & Payment History" table (MM / YY, Billed Amount, Pay-Date, Payment) that usually covers only the last 3 months.

Return ONE entry per month, as YYYY-MM (infer the year from the bill month and the order of the months), with:
- units: units consumed that month (from the table or chart), else null
- amount: the billed amount for that month, else null
- payment: the amount paid for that month, else null
If units come from the chart and amount/payment from the small table, merge them by month. A month with no value for a field gets null for that field. Do NOT include the month of the current bill itself (it is the bill, not history); the last bar of a K-Electric chart is the current month, so leave it out. Copy numbers exactly as printed (no commas). If there is no history, return an empty list. Never guess values.`;

export const HISTORY_PROMPT =
  "List the monthly consumption history shown on this bill. The first image is the full bill; later images are overlapping zoomed sections.";

export const ANSWER_SYSTEM = `You are a helpful assistant that explains an electricity bill to a customer in plain English.

Rules:
- Answer ONLY from the bill image and the FACTS provided. Do not use outside tariff, rate or regulatory knowledge. If the bill does not show a value needed to answer, say so clearly instead of guessing.
- All figures in FACTS are computed by code from the bill: use them for numbers instead of doing your own arithmetic. If you must calculate something else, do it carefully and show the working briefly.
- Label estimates explicitly ("This is an estimate: ...") and say how you calculated them.
- If a question can reasonably be read in more than one way, state the meaning you used or answer both.
- Write in English even if parts of the bill are in Urdu. Be specific and concise (2-5 sentences), quote amounts in PKR with the printed values.
- NEVER include personal identifiers (names, addresses, CNIC, account/reference/consumer/meter numbers).
- In the EXTRACTED BILL, a charge of type "fpa" is the fuel adjustment line, printed as FPA or FCA. If asked about the FCA or FPA line, answer with that charge (its amount, and the units and rate printed beside it in the image) instead of saying it is missing. Read the units and rate from that same printed row: they can differ from this month's units (an adjustment is often billed on a different month's units), so never substitute the month's total. When the row shows units and a rate, give the working as a "calculation" (units * rate). Likewise "quarterly_adjustment" is the QTA / Uniform Quarterly Adjustment line.
- Do not explain what status codes or abbreviations on the bill mean (for example "EX" in a history table) unless the bill itself spells it out. Never claim a payment status you cannot read as a number.
- Return exactly one answer per question, keeping each question_id.
- tags: choose every tag that applies. "bill" = value read straight from the bill; "calculated" = derived from bill numbers (FACTS or your own arithmetic); "estimate" = a projection or approximation; "not_on_bill" = the bill does not contain what is needed.
- calculation: the key arithmetic behind your answer as an expression using ONLY plain numbers (no commas, no currency) and + - * / ( ), for example "569.62 / 3430.24 * 100" with unit "percent". Do not write the result; the app computes it. Use unit "pkr" for money, "percent", "units" for unit counts, or "none". Use null when the answer involves no calculation. The result of your expression must be the number you state in the answer. For an estimate, put the whole working in ONE expression whose result is the final figure you state (e.g. units * rate + fixed charges + taxes), never several unrelated figures.
- visual: "tax_breakdown" for questions about taxes, "history_chart" for questions about past monthly consumption, otherwise "none".`;
