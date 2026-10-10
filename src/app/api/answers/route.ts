import { z } from "zod";
import { toImage } from "@/lib/bill/files";
import { fail } from "@/lib/bill/http";
import { answerQuestions } from "@/lib/bill/pipeline";
import { billSchema, historySchema } from "@/lib/bill/schema";

/** A whole question list for one bill takes longer than a single question. */
export const maxDuration = 60;

const body = z.object({
  analysis: z.object({ bill: billSchema, history: historySchema.shape.history }),
  questions: z
    .array(z.object({ id: z.string().min(1).max(40), text: z.string().min(1).max(600) }))
    .min(1)
    .max(30),
});

/**
 * POST multipart { file, analysis (JSON), questions (JSON [{id, text}]) }
 * -> { answers: { [id]: { answer, tags, calculation, visual } } }
 * Used by the upload flow to fill level2.csv (one call per bill, all its questions).
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const json = (name: string) => {
    try {
      return JSON.parse(String(form?.get(name) ?? ""));
    } catch {
      return null;
    }
  };
  const parsed = body.safeParse({ analysis: json("analysis"), questions: json("questions") });
  if (!(file instanceof File) || !parsed.success) {
    return Response.json(
      { error: "Send `file`, `analysis` (JSON from /api/analyze) and `questions` (JSON list of {id, text})" },
      { status: 400 },
    );
  }
  try {
    const image = toImage(file.name, new Uint8Array(await file.arrayBuffer()));
    const answers = await answerQuestions(image, parsed.data.analysis, parsed.data.questions);
    return Response.json({ answers: Object.fromEntries(answers) });
  } catch (err) {
    return fail(err);
  }
}
