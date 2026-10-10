import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Backdrop } from "@/components/layout/backdrop";
import { fontVariables } from "@/lib/typography";

// Tokens first (colours, type scale), then the design system in cascade order.
import "@/styles/colors.css";
import "@/styles/base.css";
import "@/styles/typography.css";
import "@/styles/upload.css";
import "@/styles/extract.css";
import "@/styles/ask.css";
import "@/styles/responsive.css";
import "@/styles/theme.css";
import "@/styles/logo.css";
import "@/styles/mascot.css";
import "@/styles/processing.css";
import "@/styles/background.css";
import "@/styles/nav.css";
import "@/styles/carousel.css";
import "@/styles/home.css";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: "Wattwise · Electricity bills, decoded",
  description:
    "Decode any electricity bill in plain language: extract every charge and tax, then ask questions answered only from the bill.",
};

export const viewport: Viewport = { colorScheme: "dark light" };

/**
 * Dark is the default theme and is already set on <html> in the server HTML, so first paint is
 * correct without waiting for JavaScript. This script only switches to a saved "light" choice.
 */
const THEME_SCRIPT =`try{document.documentElement.dataset.theme=localStorage.getItem("bd-theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" data-theme="dark" suppressHydrationWarning className={fontVariables}>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
