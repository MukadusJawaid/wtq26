import { z } from "zod";
import { toImage } from "@/lib/bill/files";
import { answerQuestions } from "@/lib/bill/pipeline";
import { billSchema, historySchema } from "@/lib/bill/schema";
import { fail } from "@/lib/bill/http";

/** Model calls can take 20-40 s; lets hosts such as Vercel allow that long. */
export const maxDuration = 60;

const analysisSchema = z.object({
  bill: billSchema,
  history: historySchema.shape.history,
});

/** POST multipart { file, analysis (JSON), question } -> { answer } (Level 2) */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const question = String(form?.get("question") ?? "").trim();
  const analysis = analysisSchema.safeParse(
    (() => {
      try {
        return JSON.parse(String(form?.get("analysis") ?? ""));
      } catch {
        return null;
      }
    })(),
  );
  if (!(file instanceof File) || !question || !analysis.success) {
    return Response.json(
      { error: "Send `file`, `analysis` (JSON from /api/analyze) and `question`" },
      { status: 400 },
    );
  }
  try {
    const image = toImage(file.name, new Uint8Array(await file.arrayBuffer()));
    const answers = await answerQuestions(image, analysis.data, [{ id: "Q", text: question }]);
    // { answer: { answer, tags, calculation, visual, question_id } }
    return Response.json({ answer: answers.get("Q") });
  } catch (err) {
    return fail(err);
  }
}
