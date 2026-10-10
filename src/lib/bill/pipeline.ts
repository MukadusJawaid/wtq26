import { generateStructured, type ImageInput } from "../ai";
import { appearsInText, evaluate, formatResult } from "../calc";
import { computeFacts } from "./facts";
import {
  ANSWER_SYSTEM,
  EXTRACT_PROMPT,
  EXTRACT_SYSTEM,
  HISTORY_PROMPT,
  HISTORY_SYSTEM,
} from "./prompts";
import { fitForModel, withZoomedSections } from "./image";
import {
  answersSchema,
  findInconsistencies,
  fromModelOutput,
  historySchema,
  modelBillSchema,
  type Answer,
  type Bill,
  type History,
} from "./schema";
import type { Analysis, Question } from "./types";

export type { Analysis, Question } from "./types";

/** Thrown when the image is not an electricity bill from a supported provider. */
export class UnsupportedBillError extends Error {
  constructor() {
    super("This doesn't look like a K-Electric, LESCO or IESCO electricity bill. Please upload one of those bills.");
    this.name = "UnsupportedBillError";
  }
}

type Reading = { bill: Bill; supported: boolean };

async function extractOnce(images: ImageInput[], feedback?: string[]): Promise<Reading> {
  const prompt = feedback?.length
    ? `${EXTRACT_PROMPT}\n\nYour previous reading failed these cross-checks:\n${feedback.map((f) => `- ${f}`).join("\n")}\nRe-read the relevant lines digit by digit. Fix only what you misread; if a value really is printed that way, keep it.`
    : EXTRACT_PROMPT;
  const { output } = await generateStructured(modelBillSchema, {
    system: EXTRACT_SYSTEM,
    prompt,
    images,
  });
  return fromModelOutput(output);
}

/**
 * Structured extraction from the bill image(s). If the numbers do not add up,
 * the model is asked once to re-read with the exact mismatch; the better of
 * the two readings is kept.
 */
export async function extractBill(images: ImageInput[]): Promise<Reading> {
  const first = await extractOnce(images);
  if (!first.supported) return first;
  const issues = findInconsistencies(first.bill);
  if (!issues.length) return first;
  try {
    const second = await extractOnce(images, issues);
    return second.supported && findInconsistencies(second.bill).length < issues.length ? second : first;
  } catch {
    return first;
  }
}

/** Past-months table, used to compute Level 2 statistics in code. */
export async function readHistory(images: ImageInput[]): Promise<History> {
  const { output } = await generateStructured(historySchema, {
    system: HISTORY_SYSTEM,
    prompt: HISTORY_PROMPT,
    images,
  });
  return output.history;
}

/**
 * Both extraction passes run in parallel on the same images.
 * With `rejectUnsupported` (interactive use) anything that is not a K-Electric,
 * LESCO or IESCO bill throws UnsupportedBillError. The batch leaves it off so
 * every scored bill always yields a result.
 */
export async function analyzeBill(
  image: ImageInput,
  { rejectUnsupported = false }: { rejectUnsupported?: boolean } = {},
): Promise<Analysis> {
  const images = await withZoomedSections(await fitForModel(image));
  const [reading, history] = await Promise.all([
    extractBill(images),
    // History is a bonus signal: if it fails, Level 2 still works without it.
    readHistory(images).catch(() => [] as History),
  ]);
  if (rejectUnsupported && !reading.supported) throw new UnsupportedBillError();
  return { bill: reading.bill, history };
}

/**
 * Code-side check of one answer: the expression the model gave is evaluated
 * here, and its result must appear in the answer text. Returns a description
 * of the problem, or null when the answer is consistent (or has no calculation).
 */
export function checkAnswer(answer: Answer): string | null {
  const calc = answer.calculation;
  if (!calc) return null;
  const value = evaluate(calc.expression);
  if (value === null) return `the expression "${calc.expression}" is not plain arithmetic`;
  if (appearsInText(value, answer.answer)) return null;
  return `"${calc.expression}" equals ${formatResult(value, calc.unit)}, but the answer text does not state that figure`;
}

type AskInput = { images: ImageInput[]; facts: string[]; bill: Bill; questions: Question[]; feedback?: Map<string, string> };

async function askOnce({ images, facts, bill, questions, feedback }: AskInput): Promise<Map<string, Answer>> {
  const prompt = [
    "IMAGES: the first image is the full bill; any further images are overlapping zoomed sections of the same bill. Read small print (rows, units, rates) from the zoomed sections.",
    "",
    "FACTS (computed by code from the bill):",
    ...facts.map((f) => `- ${f}`),
    "",
    "EXTRACTED BILL (JSON, may contain reading mistakes; the image is the source of truth):",
    JSON.stringify(bill),
    "",
    "QUESTIONS:",
    ...questions.map((q) => `${q.id}: ${q.text}`),
    ...(feedback?.size
      ? [
          "",
          "CORRECTIONS: your previous answers failed a code check. Rewrite them so every figure in the text matches the expression in 'calculation' (keep the expression to plain numbers, and make it the full working for the figure you state):",
          ...[...feedback].map(([id, issue]) => `- ${id}: ${issue}`),
        ]
      : []),
  ].join("\n");

  const { output } = await generateStructured(answersSchema, { system: ANSWER_SYSTEM, prompt, images });
  return matchAnswers(questions, output.answers);
}

const normaliseId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Pairs the model's answers with the questions that were asked. Ids are compared
 * ignoring case and punctuation ("q", "Q:" and "Q" all match), and when the model
 * returned exactly as many answers as questions but labelled them differently,
 * they are paired in order. Answers come back keyed by the id we asked with.
 */
export function matchAnswers(questions: Question[], answers: Answer[]): Map<string, Answer> {
  const usable = answers.filter((a) => a.answer.trim()).map((a) => ({ ...a, answer: a.answer.trim() }));
  const byId = new Map(usable.map((a) => [normaliseId(a.question_id), a]));
  const result = new Map<string, Answer>();
  questions.forEach((q, i) => {
    const hit = byId.get(normaliseId(q.id)) ?? (usable.length === questions.length ? usable[i] : undefined);
    if (hit) result.set(q.id, { ...hit, question_id: q.id });
  });
  return result;
}

/**
 * Level 2: answers every question in one call, grounded in the bill + code-computed facts.
 * Each answer's calculation is then verified in code; answers that disagree with
 * their own arithmetic are re-asked once with the exact mismatch.
 */
export async function answerQuestions(
  image: ImageInput,
  analysis: Analysis,
  questions: Question[],
): Promise<Map<string, Answer>> {
  const input: AskInput = {
    images: await withZoomedSections(await fitForModel(image)),
    facts: computeFacts(analysis.bill, analysis.history),
    bill: analysis.bill,
    questions,
  };
  const byId = await askOnce(input);

  // A question the model left unanswered gets one more try before we give up.
  let missing = questions.filter((q) => !byId.get(q.id)?.answer);
  if (missing.length) {
    const again = await askOnce({ ...input, questions: missing });
    for (const [id, answer] of again) byId.set(id, answer);
    missing = questions.filter((q) => !byId.get(q.id)?.answer);
  }
  if (missing.length) {
    throw new Error(`The model did not return an answer for ${missing.map((q) => q.id).join(", ")}. Please try again.`);
  }

  const feedback = new Map<string, string>();
  for (const q of questions) {
    const issue = checkAnswer(byId.get(q.id)!);
    if (issue) feedback.set(q.id, issue);
  }
  if (feedback.size) {
    try {
      const retry = await askOnce({ ...input, questions: questions.filter((q) => feedback.has(q.id)), feedback });
      for (const [id, answer] of retry) {
        // Keep the new answer only if it is internally consistent (or at least non-empty and no worse).
        if (answer.answer && feedback.has(id) && checkAnswer(answer) === null) byId.set(id, answer);
      }
    } catch {
      // The first answers are still usable; the re-ask is best effort.
    }
  }
  return byId;
}
