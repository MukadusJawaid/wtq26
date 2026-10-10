import type { ImageInput } from "../ai";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const IMAGE_EXTENSIONS = Object.keys(TYPES);

export function mediaTypeFor(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? null;
}

export function toImage(fileName: string, bytes: Uint8Array): ImageInput {
  const mediaType = mediaTypeFor(fileName);
  if (!mediaType) throw new Error(`Unsupported image type: ${fileName} (use PNG or JPG)`);
  return { data: bytes, mediaType };
}
