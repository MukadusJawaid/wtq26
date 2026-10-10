import { describe, expect, it } from "vitest";
import { checkAnswer } from "@/lib/bill/pipeline";
import type { Answer } from "@/lib/bill/schema";
import { appearsInText, evaluate, formatResult, prettyExpression } from "@/lib/calc";

describe("evaluate", () => {
  it("computes the tax share the way the chat shows it", () => {
    expect(evaluate("569.62 / 3430.24 * 100")).toBeCloseTo(16.6, 1);
  });
  it("respects precedence and parentheses", () => {
    expect(evaluate("2 + 3 * 4")).toBe(14);
    expect(evaluate("(2 + 3) * 4")).toBe(20);
    expect(evaluate("10 - 4 - 3")).toBe(3);
    expect(evaluate("-5 + 8")).toBe(3);
  });
  it("accepts commas and the symbols the UI prints", () => {
    expect(evaluate("3,716 − 3,430".replace("−", "-"))).toBe(286);
    expect(evaluate("6 × 7")).toBe(42);
    expect(evaluate("84 ÷ 4")).toBe(21);
  });
  it("rejects anything that is not plain arithmetic", () => {
    for (const bad of ["", "abc", "2 +", "(1 + 2", "1 / 0", "2 ** 3", "alert(1)", "1; 2", "1 2"]) {
      expect(evaluate(bad), bad).toBeNull();
    }
  });
});

describe("formatting and verification", () => {
  it("formats results by unit", () => {
    expect(formatResult(16.6102, "percent")).toBe("16.61%");
    expect(formatResult(286, "pkr")).toBe("PKR 286.00");
    expect(formatResult(2, "units")).toBe("2");
  });
  it("prettifies an expression", () => {
    expect(prettyExpression("569.62 / 3430.24 * 100")).toBe("569.62 ÷ 3,430.24 × 100");
  });
  it("checks that the computed value really appears in the answer", () => {
    expect(appearsInText(16.61, "Taxes are 16.61% of your bill")).toBe(true);
    expect(appearsInText(16.6102, "about 16.6% of the bill")).toBe(true);
    expect(appearsInText(286, "you pay PKR 286.00 more")).toBe(true);
    expect(appearsInText(286, "you pay PKR 300 more")).toBe(false);
    expect(appearsInText(0.1661, "Taxes are 16.61% of your bill")).toBe(false);
  });
});

describe("checkAnswer", () => {
  const base: Answer = { question_id: "Q", answer: "Taxes are 16.61% of your bill.", tags: ["calculated"], calculation: null, visual: "none" };
  it("accepts answers without a calculation or with a matching one", () => {
    expect(checkAnswer(base)).toBeNull();
    expect(checkAnswer({ ...base, calculation: { expression: "569.62 / 3430.24 * 100", unit: "percent" } })).toBeNull();
  });
  it("flags an answer whose figure differs from its own arithmetic", () => {
    const bad = { ...base, answer: "About PKR 4,547.00", calculation: { expression: "201 * 11.37 + 900 + 177.11", unit: "pkr" as const } };
    expect(checkAnswer(bad)).toContain("3,362.48");
    expect(checkAnswer({ ...base, calculation: { expression: "alert(1)", unit: "none" } })).toContain("not plain arithmetic");
  });
});
