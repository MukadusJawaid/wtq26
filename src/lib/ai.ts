import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output, type LanguageModel } from "ai";
import type { z } from "zod";

/**
 * AI layer. Everything that talks to a model goes through this file.
 *
 * Configuration (see .env.example):
 *   MODEL_PROVIDER  anthropic
 *   MODEL_NAME      claude-haiku-4-5
 *   API_KEY         your Anthropic API key
 *
 * This project calls one approved model only (Claude Haiku 4.5). Any other
 * value is rejected up front, because using a non-approved model is a
 * disqualification.
 */

const APPROVED = {
  "claude-haiku-4-5": "anthropic",
} as const;

export type ModelId = keyof typeof APPROVED;
type Provider = (typeof APPROVED)[ModelId];

const TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
/** Anthropic rejects images above 5 MB. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class AiError extends Error {
  constructor(
    readonly kind: "config" | "input" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type ImageInput = { data: Uint8Array; mediaType: string };

const isModelId = (id: string): id is ModelId => id in APPROVED;

/** The validated model configuration from the environment. */
export function modelConfig(): {
  provider: Provider;
  name: ModelId;
  apiKey: string;
} {
  const name = process.env.MODEL_NAME?.trim() ?? "";
  const provider = process.env.MODEL_PROVIDER?.trim() ?? "";
  const apiKey = process.env.API_KEY?.trim() ?? "";

  if (!isModelId(name)) {
    throw new AiError(
      "config",
      `MODEL_NAME "${name}" is not approved. Allowed: ${Object.keys(APPROVED).join(", ")}`,
    );
  }
  if (APPROVED[name] !== provider) {
    throw new AiError(
      "config",
      `MODEL_PROVIDER "${provider}" does not match ${name} (expected "${APPROVED[name]}")`,
    );
  }
  if (!apiKey) throw new AiError("config", "API_KEY is not set");
  return { provider: APPROVED[name], name, apiKey };
}

function buildModel(): { model: LanguageModel; id: ModelId } {
  const { name, apiKey } = modelConfig();
  const model = createAnthropic({ apiKey })(name);
  return { model, id: name };
}

const callOptions = () => ({
  abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  maxRetries: MAX_RETRIES,
  // Deterministic as far as the provider allows: reruns should match.
  temperature: 0,
});

const wrap = (err: unknown): never => {
  if (err instanceof AiError) throw err;
  throw new AiError(
    "unavailable",
    err instanceof Error ? err.message : String(err),
  );
};

type Request = { system?: string; prompt: string; images?: ImageInput[] };

function messagesFor({ prompt, images }: Request) {
  if (!images?.length) return { prompt };
  if (images.some((img) => img.data.byteLength > MAX_IMAGE_BYTES)) {
    throw new AiError("input", "Image is larger than 5 MB");
  }
  return {
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: prompt },
          ...images.map((img) => ({
            type: "file" as const,
            mediaType: img.mediaType,
            data: img.data,
          })),
        ],
      },
    ],
  };
}

/** JSON answer validated against a zod schema, optionally about an image. */
export async function generateStructured<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<{ output: z.infer<T>; model: ModelId }> {
  const { model, id } = buildModel();
  try {
    const { output } = await generateText({
      model,
      system: request.system,
      output: Output.object({ schema }),
      ...messagesFor(request),
      ...callOptions(),
    });
    if (output == null) throw new Error("model returned no structured output");
    return { output: output as z.infer<T>, model: id };
  } catch (err) {
    return wrap(err);
  }
}
