import { describe, expect, it } from "vitest";
import { matchAnswers } from "@/lib/bill/pipeline";
import type { Answer } from "@/lib/bill/schema";

const answer = (question_id: string, text: string): Answer => ({
  question_id,
  answer: text,
  tags: ["bill"],
  calculation: null,
  visual: "none",
});

const q = (id: string) => ({ id, text: `question ${id}` });

describe("matchAnswers", () => {
  it("pairs answers by id", () => {
    const m = matchAnswers([q("Q1"), q("Q2")], [answer("Q2", "two"), answer("Q1", "one")]);
    expect(m.get("Q1")?.answer).toBe("one");
    expect(m.get("Q2")?.answer).toBe("two");
  });

  it("ignores case and punctuation in the ids the model returns", () => {
    for (const label of ["q", "Q:", " Q ", "q."]) {
      expect(matchAnswers([q("Q")], [answer(label, "ok")]).get("Q")?.answer).toBe("ok");
    }
  });

  it("pairs by order when the model relabelled everything but answered every question", () => {
    const m = matchAnswers([q("Q")], [answer("Q1", "the FCA line is...")]);
    expect(m.get("Q")?.answer).toBe("the FCA line is...");
    expect(m.get("Q")?.question_id).toBe("Q"); // keyed and labelled with the id we asked
  });

  it("does not guess when the counts differ", () => {
    const m = matchAnswers([q("Q1"), q("Q2")], [answer("zzz", "one answer for two questions")]);
    expect(m.size).toBe(0);
  });

  it("drops empty answers", () => {
    expect(matchAnswers([q("Q1")], [answer("Q1", "   ")]).size).toBe(0);
  });
});
