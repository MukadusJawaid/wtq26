import { toImage } from "@/lib/bill/files";
import { fail } from "@/lib/bill/http";
import { analyzeBill } from "@/lib/bill/pipeline";

/** Model calls can take 20-40 s; lets hosts such as Vercel allow that long. */
export const maxDuration = 60;

/** POST multipart { file } -> { bill, history } (Level 1) */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a PNG or JPG bill as `file`" }, { status: 400 });
  }
  try {
    const image = toImage(file.name, new Uint8Array(await file.arrayBuffer()));
    // Interactive use: reject anything that is not a K-Electric, LESCO or IESCO bill.
    return Response.json(await analyzeBill(image, { rejectUnsupported: true }));
  } catch (err) {
    return fail(err);
  }
}
