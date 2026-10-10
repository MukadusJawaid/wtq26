import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Native <details> with the design's chevron summary. */
export function Collapsible({
  title,
  badge,
  defaultOpen,
  className,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn(className)}>
      <summary>
        <span className="sr">
          <span>{title}</span>
          {badge}
        </span>
        <span className="chev">
          <Icon name="chevronDown" size={16} strokeWidth={2.6} />
        </span>
      </summary>
      {children}
    </details>
  );
}
