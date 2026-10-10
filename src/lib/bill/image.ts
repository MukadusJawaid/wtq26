import sharp from "sharp";
import type { ImageInput } from "../ai";

/**
 * Vision models downscale large images, which blurs the small print in the
 * charges table. We send the full bill plus overlapping zoomed sections
 * (top to bottom, or left to right for wide photos) so every line stays legible.
 */

/** The model API rejects images above 5 MB; stay safely below it. */
const MAX_BYTES = 4.5 * 1024 * 1024;

/** Re-encodes oversized images (smaller JPEG, shrinking until it fits) so users can upload up to 10 MB. */
export async function fitForModel(image: ImageInput): Promise<ImageInput> {
  if (image.data.byteLength <= MAX_BYTES) return image;
  let smallest = image;
  for (const longEdge of [3200, 2600, 2000, 1600]) {
    try {
      const data = new Uint8Array(
        await sharp(image.data, { failOn: "none" })
          .rotate()
          .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer(),
      );
      smallest = { data, mediaType: "image/jpeg" };
      if (data.byteLength <= MAX_BYTES) return smallest;
    } catch {
      break;
    }
  }
  return smallest;
}

const OVERLAP = 0.2;
const MIN_SHORT_SIDE = 1400;
const SECTION_RATIO = 0.62; // section length along the long axis / bill width

export async function withZoomedSections(image: ImageInput): Promise<ImageInput[]> {
  try {
    // Honour EXIF orientation, then upscale small photos so fine print is legible.
    const oriented = await sharp(image.data, { failOn: "none" }).rotate().png().toBuffer();
    const meta = await sharp(oriented).metadata();
    const w0 = meta.width ?? 0;
    const h0 = meta.height ?? 0;
    if (!w0 || !h0) return [image];

    const scale = Math.min(w0, h0) < MIN_SHORT_SIDE ? MIN_SHORT_SIDE / Math.min(w0, h0) : 1;
    const base = scale > 1 ? sharp(oriented).resize(Math.round(w0 * scale), Math.round(h0 * scale), { kernel: "lanczos3" }) : sharp(oriented);
    const src = sharp(await base.png().toBuffer());
    const width = Math.round(w0 * scale);
    const height = Math.round(h0 * scale);

    const tall = height >= width;
    const long = tall ? height : width;
    const short = tall ? width : height;
    if (long / short < 1.05) return [image];

    const size = Math.round(short * SECTION_RATIO);
    const step = Math.round(size * (1 - OVERLAP));
    const starts: number[] = [];
    for (let s = 0; s + size < long; s += step) starts.push(s);
    starts.push(long - size);

    const sections = await Promise.all(
      starts.map(async (start) => ({
        mediaType: "image/png",
        data: new Uint8Array(
          await src
            .clone()
            .extract(
              tall
                ? { left: 0, top: start, width, height: size }
                : { left: start, top: 0, width: size, height },
            )
            .png()
            .toBuffer(),
        ),
      })),
    );
    return [image, ...sections];
  } catch {
    // Unreadable metadata or odd formats: fall back to the plain image.
    return [image];
  }
}
