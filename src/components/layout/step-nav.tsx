"use client";

import { useLayoutEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { STEPS, useAppStore, type Step } from "@/store/app-store";

const TABS: { step: Step; label: string; icon: IconName }[] = [
  { step: STEPS.home, label: "Home", icon: "home" },
  { step: STEPS.upload, label: "Upload", icon: "upload" },
  { step: STEPS.extract, label: "Extract", icon: "doc" },
  { step: STEPS.ask, label: "Ask", icon: "chat" },
  { step: STEPS.batch, label: "Batch run", icon: "layers" },
];

/** The five-step tab bar with a sliding highlight (a bottom dock on phones). */
export function StepNav() {
  const step = useAppStore((s) => s.step);
  const go = useAppStore((s) => s.go);
  const navRef = useRef<HTMLElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    function place() {
      const selected = navRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      const ind = indRef.current;
      if (!selected || !ind) return;
      ind.style.width = `${selected.offsetWidth}px`;
      ind.style.height = `${selected.offsetHeight}px`;
      ind.style.transform = `translate(${selected.offsetLeft}px,${selected.offsetTop}px)`;
    }
    place();
    window.addEventListener("resize", place);
    // Fonts, breakpoints and label changes all resize the tabs; keep the highlight glued to the active one.
    document.fonts?.ready.then(place);
    const observer = new ResizeObserver(place);
    if (navRef.current) observer.observe(navRef.current);
    return () => {
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [step]);

  return (
    <nav className="steps" role="tablist" aria-label="Sections" ref={navRef}>
      <span className="ind" ref={indRef} aria-hidden="true" />
      {TABS.map(({ step: n, label, icon }) => (
        <button
          key={n}
          className="tab"
          role="tab"
          id={`t${n}`}
          aria-selected={n === step}
          aria-controls={`p${n}`}
          onClick={() => go(n)}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
