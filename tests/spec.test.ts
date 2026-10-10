import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError, modelConfig } from "@/lib/ai";
import { LEVEL1_COLUMNS, LEVEL2_COLUMNS, readCsv, writeCsv } from "@/lib/batch/csv";
import { inspectBatch } from "@/lib/batch/run";
import { billSchema, CHARGE_TYPES, TAX_TYPES } from "@/lib/bill/schema";

/**
 * These tests encode rules from the WTQ Build Track Participant Guide, so a
 * regression against the spec fails loudly instead of silently losing marks.
 */

const nulls = {
  provider: null, tariff: null, sanctioned_load_kw: null, bill_month: null, reading_date: null,
  issue_date: null, due_date: null, previous_reading: null, current_reading: null, units_consumed: null,
  charges: [], total_charges: null, taxes: [], total_taxes: null, current_bill: null, arrears: null,
  payable_within_due_date: null, payable_after_due_date: null,
};

describe("guide section 5: Level 1 schema", () => {
  it("has exactly the fields of section 5.1 (every field present, even when null)", () => {
    const required = [
      "provider", "tariff", "sanctioned_load_kw", "bill_month", "reading_date", "issue_date", "due_date",
      "previous_reading", "current_reading", "units_consumed", "charges", "total_charges", "taxes",
      "total_taxes", "current_bill", "arrears", "payable_within_due_date", "payable_after_due_date",
    ];
    expect(Object.keys(billSchema.shape).sort()).toEqual([...required].sort());
    expect(billSchema.safeParse(nulls).success).toBe(true);
    const missing: Partial<typeof nulls> = { ...nulls };
    delete missing.tariff;
    expect(billSchema.safeParse(missing).success).toBe(false);
  });

  it("uses the charge and tax types of section 5.4", () => {
    expect([...CHARGE_TYPES]).toEqual([
      "energy", "fixed", "fpa", "quarterly_adjustment", "surcharge", "meter_rent", "subsidy", "other",
    ]);
    expect([...TAX_TYPES]).toEqual(["gst", "electricity_duty", "income_tax", "municipal_tax", "other_tax"]);
  });

  it("only allows the three providers and numeric (not string) amounts", () => {
    expect(billSchema.safeParse({ ...nulls, provider: "KESC" }).success).toBe(false);
    expect(billSchema.safeParse({ ...nulls, provider: "KE" }).success).toBe(true);
    expect(billSchema.safeParse({ ...nulls, total_taxes: "569.62" }).success).toBe(false);
    expect(billSchema.safeParse({ ...nulls, charges: [{ type: "energy", amount: "10" }] }).success).toBe(false);
  });
});

describe("guide sections 5.9 and 7.2: CSV files", () => {
  async function tmp() {
    return mkdtemp(path.join(os.tmpdir(), "wattwise-"));
  }

  it("writes a Level 1 row on one line with doubled quotes (section 5.9)", async () => {
    const dir = await tmp();
    const file = path.join(dir, "level1.csv");
    const json = JSON.stringify({ ...nulls, provider: "KE", tariff: "A1-R", sanctioned_load_kw: 3 });
    await writeCsv(file, LEVEL1_COLUMNS, [{ bill_id: "KESC_0008", json }]);
    const lines = (await readFile(file, "utf8")).trimEnd().split("\n");
    expect(lines).toHaveLength(2); // header + one row: JSON never spills onto extra lines
    expect(lines[0]).toBe("bill_id,json");
    expect(lines[1].startsWith('KESC_0008,"{""provider"":""KE"",""tariff"":""A1-R"",""sanctioned_load_kw"":3,')).toBe(true);
  });

  it("keeps columns and row order, and round-trips commas, quotes, line breaks and Urdu (section 7.2)", async () => {
    const dir = await tmp();
    const file = path.join(dir, "level2.csv");
    const rows = [
      { bill_id: "B2", question_id: "Q1", question: "Why, exactly?", answer: 'He said "yes"' },
      { bill_id: "B1", question_id: "Q2", question: "Line\nbreak?", answer: "بجلی کا بل = PKR 3,430.24" },
    ];
    await writeCsv(file, LEVEL2_COLUMNS, rows);
    const text = await readFile(file, "utf8");
    expect(text.split("\n")[0]).toBe("bill_id,question_id,question,answer");
    expect(await readCsv(file)).toEqual(rows); // same rows, same order, same content
  });
});

describe("guide section 4.2: templates", () => {
  it("counts bills, questions and rows, and names what is missing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "wattwise-batch-"));
    const bills = path.join(root, "bills");
    const csv = path.join(root, "csv");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(bills);
    await mkdir(csv);
    await writeFile(path.join(csv, "level1.csv"), "bill_id,json\nKESC_0002,\nLESCO_0008,\n");
    await writeFile(
      path.join(csv, "level2.csv"),
      "bill_id,question_id,question,answer\nKESC_0002,Q1,a?,\nKESC_0002,Q2,b?,\nLESCO_0008,Q1,a?,\nLESCO_0008,Q2,b?,\n",
    );
    await writeFile(path.join(bills, "KESC_0002.png"), "x");

    const info = await inspectBatch({ billsDir: bills, templatesDir: csv, outDir: path.join(root, "out") });
    expect(info).toMatchObject({ bills: 2, questions: 2, rows1: 2, rows2: 4, ready: false });
    expect(info.missing).toEqual(["test/bills/LESCO_0008.png"]);

    await writeFile(path.join(bills, "LESCO_0008.jpg"), "x");
    expect((await inspectBatch({ billsDir: bills, templatesDir: csv, outDir: "x" })).ready).toBe(true);
  });
});

describe("guide sections 3, 7.4, 7.6: approved model only, configured by the 3 variables", () => {
  afterEach(() => vi.unstubAllEnvs());
  const env = (provider: string, name: string, key: string) => {
    vi.stubEnv("MODEL_PROVIDER", provider);
    vi.stubEnv("MODEL_NAME", name);
    vi.stubEnv("API_KEY", key);
  };

  it("accepts Claude Haiku 4.5 with a key", () => {
    env("anthropic", "claude-haiku-4-5", "k");
    expect(modelConfig()).toMatchObject({ provider: "anthropic", name: "claude-haiku-4-5" });
  });
  it("rejects any other model, a mismatched provider, or a missing key", () => {
    env("anthropic", "claude-sonnet-5-5", "k");
    expect(() => modelConfig()).toThrow(AiError);
    env("openai", "claude-haiku-4-5", "k");
    expect(() => modelConfig()).toThrow(/does not match/);
    env("anthropic", "claude-haiku-4-5", "");
    expect(() => modelConfig()).toThrow(/API_KEY/);
  });
});
