import { AiError } from "../ai";
import { UnsupportedBillError } from "./pipeline";

/** Maps an error from the pipeline to a JSON error response. */
export function fail(err: unknown) {
  if (err instanceof UnsupportedBillError) {
    return Response.json({ error: err.message, code: "unsupported_bill" }, { status: 422 });
  }
  if (err instanceof AiError) {
    const status = err.kind === "config" ? 500 : err.kind === "input" ? 400 : 503;
    return Response.json({ error: err.message }, { status });
  }
  const message = err instanceof Error ? err.message : "Unexpected server error";
  return Response.json({ error: message }, { status: 400 });
}
