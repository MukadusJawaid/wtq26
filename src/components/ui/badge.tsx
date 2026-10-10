import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "ok" | "bad" | "warn" | "pri" | "late";

export function Badge({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("badge", tone, className)} {...props} />;
}

export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("eyebrow", className)} {...props} />;
}
