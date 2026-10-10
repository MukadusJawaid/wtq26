import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Fonts, loaded once and self-hosted by next/font (latin subset only, variable files: one request per family).
 *   --font-jakarta    body text and UI
 *   --font-bricolage  headings and big numbers
 *   --font-jetbrains  figures, code, amounts
 * The design maps these onto --sans / --disp / --mono in styles/base.css.
 * Arabic-script text (decorative only) uses the system font, which keeps the download small.
 */

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  preload: false, // figures and code only; not needed for first paint
  display: "swap",
});

/** Class names that define the three font CSS variables; put them on <html>. */
export const fontVariables = [sans, display, mono].map((f) => f.variable).join(" ");
