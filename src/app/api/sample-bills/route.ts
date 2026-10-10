import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { defaultPaths } from "@/lib/batch/paths";

const IMAGE = /\.(png|jpe?g)$/i;

/**
 * GET: the supplied bills in test/bills. Without a query it lists their file names; with `?name=`
 * it returns that one image. Lets the batch page generate the CSVs without uploading anything.
 */
export async function GET(request: Request) {
  const dir = defaultPaths().billsDir;
  const name = new URL(request.url).searchParams.get("name");

  if (!name) {
    const files = await readdir(dir).catch(() => [] as string[]);
    return Response.json({ bills: files.filter((f) => IMAGE.test(f)).sort() }, { headers: { "Cache-Control": "no-store" } });
  }

  const safe = path.basename(name);
  if (!IMAGE.test(safe)) return new Response("Not found", { status: 404 });
  const bytes = await readFile(path.join(dir, safe)).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": /\.png$/i.test(safe) ? "image/png" : "image/jpeg", "Cache-Control": "no-store" },
  });
}
