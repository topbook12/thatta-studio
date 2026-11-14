"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Guided first-run tour (Phase 1, Day 1–10)
//
// 4-step coach-mark tour: stage → timeline → voice → export.
// Auto-opens once for first-time users; replayable from the toolbar.
// The spotlight is a full-screen overlay with a cut-out around the
// target element (box-shadow trick) + a Bangla tooltip card.
// ============================================================

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  /** DOM id of the element to spotlight */
  targetId: string;
  title: string;
  body: string;
}

const TOUR_DONE_KEY = "thatta.tour.v1.done";

export function tourAlreadyDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

const bnNum = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vh, setVh] = useState(800);

  // reset to the first step whenever the tour opens (render-time adjustment —
  // the React-recommended pattern for reacting to prop changes)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIdx(0);
  }

  // keep the spotlight glued to the target (resize / scroll / layout shifts)
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      setVh(window.innerHeight);
      const el = document.getElementById(steps[idx]?.targetId ?? "");
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const raf = setTimeout(measure, 350); // after smooth scroll settles
    const poll = setInterval(measure, 700);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(raf);
      clearInterval(poll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, idx, steps]);

  // scroll each target into view
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(steps[idx]?.targetId ?? "");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open, idx, steps]);

  if (!open || steps.length === 0) return null;

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const PAD = 8;
  const hasTarget = !!rect && rect.width > 4 && rect.height > 4;

  // tooltip placement: below the target when there's room, else above
  const winW = typeof window !== "undefined" ? window.innerWidth : 400;
  const cardW = Math.min(330, winW - 24);
  let cardTop: number;
  let above = false;
  if (!hasTarget || !rect) {
    cardTop = vh - 270;
  } else if (rect.top + rect.height + 230 < vh) {
    cardTop = rect.top + rect.height + PAD + 10;
  } else if (rect.top > 240) {
    cardTop = rect.top - PAD - 10;
    above = true;
  } else {
    cardTop = vh - 270;
  }
  const cardLeft = hasTarget && rect
    ? Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, winW - cardW - 12))
    : 24;

  const next = () => (isLast ? onClose() : setIdx((i) => i + 1));

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="ব্যবহার গাইড"
      data-testid="guided-tour"
    >
      {/* dim everything except the spotlight hole */}
      <div className="absolute inset-0 bg-black/50" onClick={() => {}} />

      {hasTarget && rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-orange-400 transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      )}

      <div
        className="absolute rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-2xl"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardW,
          transform: above ? "translateY(-100%)" : undefined,
        }}
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-600">
          গাইডেড ট্যুর • {bnNum(idx + 1)}/{bnNum(steps.length)}
        </p>
        <h3 className="mb-1.5 text-base font-extrabold text-amber-950">{step.title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-amber-800">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              markTourDone();
              onClose();
            }}
            className="text-amber-600 hover:text-amber-800"
          >
            বাদ দিন
          </Button>
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-orange-600" : "bg-amber-200"}`}
              />
            ))}
          </div>
          <Button size="sm" onClick={next} className="bg-orange-600 text-white hover:bg-orange-700">
            {isLast ? "শুরু করি! 🎬" : "পরের ধাপ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
