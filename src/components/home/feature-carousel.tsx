"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { fixed2, linesAddUp, PROVIDER_LABEL, whole } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STEPS, useAppStore } from "@/store/app-store";
import type { Bill } from "@/lib/bill/types";

const GAP = 14;
const AUTOPLAY_MS = 5200;

type Slide = { cls: string; icon: IconName; title: string; text: string; visual: (bill: Bill | null) => ReactNode };

const HOW_IT_WORKS = [
  { title: "Add your bill", text: "Upload a photo, scan or screenshot." },
  { title: "We read it", text: "Every charge, tax and date is pulled out and checked." },
  { title: "Ask questions", text: "Get plain-English answers about your bill." },
];

const SLIDES: Slide[] = [
  {
    cls: "s7",
    icon: "sparkle",
    title: "How it works",
    text: "Three steps from a photo to answers.",
    visual: () => (
      <ol className="hw">
        {HOW_IT_WORKS.map((s, i) => (
          <li key={s.title}>
            <b>{i + 1}</b>
            <span>
              <strong>{s.title}</strong>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    cls: "s1",
    icon: "list",
    title: "Every detail, organised",
    text: "Tariff, readings, charges, taxes and payable amounts, laid out clearly.",
    visual: (bill) => (
      <div className="vj">
        <i>{`provider · ${bill?.provider ? PROVIDER_LABEL[bill.provider] : "…"}`}</i>
        <i>{`units · ${bill?.units_consumed ?? "…"}`}</i>
        <i>{`taxes · ${bill?.total_taxes != null ? fixed2(bill.total_taxes) : "…"}`}</i>
        <i>{`payable · ${bill?.payable_within_due_date != null ? whole(bill.payable_within_due_date) : "…"}`}</i>
      </div>
    ),
  },
  {
    cls: "s2",
    icon: "check",
    title: "Honest answers",
    text: "Estimates are labelled and missing values are flagged, never guessed.",
    visual: () => (
      <div className="vt">
        <Badge tone="pri">From the bill</Badge>
        <Badge tone="ok">Calculated</Badge>
        <Badge tone="warn">Estimate</Badge>
      </div>
    ),
  },
  {
    cls: "s3",
    icon: "lock",
    title: "Privacy first",
    text: "Names, CNIC, account and meter numbers are never extracted.",
    visual: () => (
      <div className="vp">
        <i className="ln" />
        <i className="bx" />
        <i className="ln s" />
        <i className="bx b" />
      </div>
    ),
  },
  {
    cls: "s4",
    icon: "bolt",
    title: "Works on messy bills",
    text: "Tilted photos, Urdu labels and grey-boxed fields.",
    visual: () => (
      <div className="vm2">
        <div className="paper">
          <i />
          <i />
          <b>بجلی کا بل</b>
        </div>
        <span className="ok">Read as printed ✓</span>
      </div>
    ),
  },
  {
    cls: "s5",
    icon: "circleCheck",
    title: "Checks its own maths",
    text: "Line items are added up and compared with every printed total before you see them.",
    visual: (bill) => {
      const rows: [string, number | null, boolean | null][] = [
        ["charges", bill?.total_charges ?? null, bill ? linesAddUp(bill.charges, bill.total_charges) : null],
        ["taxes", bill?.total_taxes ?? null, bill ? linesAddUp(bill.taxes, bill.total_taxes) : null],
      ];
      return (
        <div className="vm">
          {rows.map(([label, total, ok]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{total == null ? "—" : fixed2(total)}</b>
              <em>{ok === null ? "" : ok ? "✓" : "!"}</em>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    cls: "s6",
    icon: "building",
    title: "Three providers, one tool",
    text: "Each utility lays out its bill differently. The reader adapts to all of them.",
    visual: () => (
      <div className="vv">
        <span>K-Electric</span>
        <span>LESCO</span>
        <span>IESCO</span>
      </div>
    ),
  },
];

/** Width of one slide plus the gap, i.e. how far one "page" scrolls. */
const stepWidth = (track: HTMLElement | null) =>
  ((track?.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? 0) + GAP;
const currentIndex = (track: HTMLElement | null) => Math.round((track?.scrollLeft ?? 0) / (stepWidth(track) || 1));
const atEnd = (track: HTMLElement | null) => !!track && track.scrollLeft + track.clientWidth >= track.scrollWidth - 6;

export function FeatureCarousel() {
  const bill = useAppStore((s) => s.analysis?.bill ?? null);
  const onHome = useAppStore((s) => s.step === STEPS.home);
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(SLIDES.length);
  const [snap, setSnap] = useState(false);

  // Snap-scrolling starts after the first paint has settled (keeps the page measurable for LCP).
  useEffect(() => {
    const t = setTimeout(() => setSnap(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion.current) setPaused(true);
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const w = stepWidth(track);
    if (!track || !w) return;
    const perView = Math.max(1, Math.round(track.clientWidth / w));
    setPages(Math.max(1, SLIDES.length - perView + 1));
  }, []);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    track?.scrollTo({ left: i * stepWidth(track), behavior: reduceMotion.current ? "auto" : "smooth" });
  }, []);

  const next = useCallback(() => {
    const track = trackRef.current;
    goTo(atEnd(track) ? 0 : currentIndex(track) + 1);
  }, [goTo]);
  const prev = useCallback(() => {
    const track = trackRef.current;
    goTo((track?.scrollLeft ?? 0) <= 6 ? pages - 1 : currentIndex(track) - 1);
  }, [goTo, pages]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    if (paused || held || !onHome) return;
    const id = setInterval(() => !document.hidden && next(), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, held, onHome, next]);

  return (
    <section
      className="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="What makes Wattwise different"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setTimeout(() => setHeld(false), 4000)}
    >
      <div className="car-head">
        <h2>Built for real-world bills</h2>
        <div className="car-ctl">
          <button
            className={cn("car-b", paused && "paused")}
            type="button"
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            onClick={() => setPaused((p) => !p)}
          >
            <Icon name="pause" size={16} filled className="pa" />
            <Icon name="play" size={16} filled className="pl" />
          </button>
          <button className="car-b" type="button" aria-label="Previous card" onClick={prev}>
            <Icon name="chevronLeft" strokeWidth={2.6} />
          </button>
          <button className="car-b" type="button" aria-label="Next card" onClick={next}>
            <Icon name="chevronRight" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <div
        className={cn("car-track", snap && "snap")}
        ref={trackRef}
        tabIndex={0}
        aria-label="Feature cards, use left and right arrow keys"
        onScroll={(e) => setPage(Math.min(currentIndex(e.currentTarget), pages - 1))}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          }
        }}
      >
        {SLIDES.map((s) => (
          <div key={s.title} className={cn("slide", s.cls)} role="group" aria-roledescription="slide">
            <span className="ck">
              <Icon name={s.icon} size={22} />
            </span>
            <strong>{s.title}</strong>
            <span className="d">{s.text}</span>
            <div className="vis" aria-hidden="true">
              {s.visual(bill)}
            </div>
          </div>
        ))}
      </div>
      <div className="dots">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            className={cn(i === page && "on")}
            aria-label={`Go to card ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </section>
  );
}
