"use client";

import { STEPS, useAppStore } from "@/store/app-store";
import { Logo } from "./logo";
import { StepNav } from "./step-nav";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const go = useAppStore((s) => s.go);
  return (
    <header>
      {/* .wrap supplies the side gutter so the floating bar never touches the screen edges */}
      <div className="wrap">
        <div className="bar">
          <Logo onClick={() => go(STEPS.home)} />
          <StepNav />
          <div className="hr">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
