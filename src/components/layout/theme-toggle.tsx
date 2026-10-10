"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

const KEY = "bd-theme";
type Theme = "dark" | "light";
let fadeTimer: number | undefined;

/** Light/dark switch. The no-flash script in the root layout applies the saved theme first. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // brief colour fade so the switch isn't abrupt; the flag is removed once it has played
    root.dataset.fade = "";
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => delete root.dataset.fade, 500);
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage can be blocked (private mode); the theme still switches for this visit
    }
    setTheme(next);
  }

  return (
    <button
      className="theme"
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title="Light / dark"
      suppressHydrationWarning
    >
      <Icon name="moon" size={19} className="moon" />
      <Icon name="sun" size={19} className="sun" />
    </button>
  );
}
