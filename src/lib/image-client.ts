/**
 * Browser-side image shrinking. Hosts like Vercel reject request bodies above
 * ~4.5 MB, so larger photos are re-encoded as JPEG before upload. Small files
 * are sent untouched.
 */

const TARGET_BYTES = 4 * 1024 * 1024;
const EDGES = [3200, 2600, 2000, 1600];

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    for (const edge of EDGES) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#fff"; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await toBlob(canvas, 0.85);
      if (blob && blob.size <= TARGET_BYTES) {
        bitmap.close();
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    bitmap.close();
  } catch {
    // unreadable in this browser: fall through and let the server decide
  }
  return file;
}
