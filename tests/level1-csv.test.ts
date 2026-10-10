import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import type { Bill } from "@/lib/bill/schema";
import { billIdsFromNames, buildLevel1Csv } from "@/lib/level1-csv";

const bill: Bill = {
  provider: "KE", tariff: "A1-R", sanctioned_load_kw: 3, bill_month: "2026-04", reading_date: "2026-04-03",
  issue_date: "2026-04-07", due_date: "2026-04-21", previous_reading: 8819, current_reading: 8970,
  units_consumed: 151, charges: [{ type: "fixed", amount: 900 }], total_charges: 900, taxes: [],
  total_taxes: null, current_bill: 3430.24, arrears: -0.53, payable_within_due_date: 3430,
  payable_after_due_date: 3716,
};

describe("browser-built level1.csv", () => {
  it("follows the guide: bill_id,json, one line per bill, doubled quotes", () => {
    const csv = buildLevel1Csv([{ billId: "KESC_0008", bill }]);
    const lines = csv.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("bill_id,json");
    expect(lines[1].startsWith('KESC_0008,"{""provider"":""KE"",""tariff"":""A1-R"",')).toBe(true);
  });

  it("round-trips through a real CSV parser with every field intact", () => {
    const rows = parse(buildLevel1Csv([{ billId: "A", bill }, { billId: "B", bill: { ...bill, tariff: 'x,"y"' } }]), {
      columns: true,
    }) as { bill_id: string; json: string }[];
    expect(rows.map((r) => r.bill_id)).toEqual(["A", "B"]);
    expect(JSON.parse(rows[0].json)).toEqual(bill);
    expect(JSON.parse(rows[1].json).tariff).toBe('x,"y"');
  });

  it("derives bill ids from file names and keeps repeats distinct", () => {
    expect(billIdsFromNames(["KESC_0008.png", "LESCO_0005.jpg", "KESC_0008.jpeg", "noext", "a.b.png"])).toEqual([
      "KESC_0008", "LESCO_0005", "KESC_0008_2", "noext", "a.b",
    ]);
  });
});

import { buildLevel2Csv, readTemplate } from "@/lib/level1-csv";

describe("supplied templates (read in the browser)", () => {
  it("recognises level2.csv by its header and keeps every row in order", () => {
    const t = readTemplate("﻿bill_id,question_id,question,answer\nA,Q1,\"Why, exactly?\",\nA,Q2,How?,\nB,Q1,\"Why, exactly?\",\n");
    expect(t?.kind).toBe("level2");
    if (t?.kind !== "level2") return;
    expect(t.rows.map((r) => `${r.bill_id}/${r.question_id}`)).toEqual(["A/Q1", "A/Q2", "B/Q1"]);
    expect(t.rows[0].question).toBe("Why, exactly?");
    expect(t.rows.every((r) => r.answer === "")).toBe(true);
  });

  it("recognises level1.csv and returns the bill order", () => {
    expect(readTemplate("bill_id,json\nIESCO_0002,\nKESC_0002,\n")).toEqual({ kind: "level1", ids: ["IESCO_0002", "KESC_0002"] });
  });

  it("rejects files that are neither template", () => {
    expect(readTemplate("a,b\n1,2\n")).toBeNull();
    expect(readTemplate("")).toBeNull();
  });

  it("writes level2.csv with the template's columns, quoting commas, quotes and line breaks", () => {
    const csv = buildLevel2Csv([{ bill_id: "A", question_id: "Q1", question: "Why, exactly?", answer: 'He said "yes"\nthen left' }]);
    const rows = parse(csv, { columns: true }) as Record<string, string>[];
    expect(csv.split("\n")[0]).toBe("bill_id,question_id,question,answer");
    expect(rows).toEqual([{ bill_id: "A", question_id: "Q1", question: "Why, exactly?", answer: 'He said "yes"\nthen left' }]);
  });
});
