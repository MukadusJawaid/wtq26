import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultPaths } from "@/lib/batch/paths";

/**
 * GET: the two supplied templates (test/csv/level1.csv and test/csv/level2.csv), so the upload flow
 * starts with the questions already selected. A missing file comes back as null.
 */
export async function GET() {
  const dir = defaultPaths().templatesDir;
  const read = (name: string) => readFile(path.join(dir, name), "utf8").catch(() => null);
  const [level1, level2] = await Promise.all([read("level1.csv"), read("level2.csv")]);
  return Response.json({ level1, level2 }, { headers: { "Cache-Control": "no-store" } });
}
