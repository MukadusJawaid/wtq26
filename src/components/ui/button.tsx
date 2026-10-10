import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "pri" | "volt" | "sec" | "ghost";

const classes = (variant: Variant, big?: boolean, className?: string) =>
  cn("btn", variant, big && "big", className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean };

export function Button({ variant = "pri", big, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={classes(variant, big, className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; big?: boolean };

/** An anchor that looks like a button (used for file downloads). */
export function LinkButton({ variant = "sec", big, className, ...props }: LinkButtonProps) {
  return <a className={classes(variant, big, className)} {...props} />;
}
