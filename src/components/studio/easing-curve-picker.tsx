"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 3: স্পিড গ্রাফ (ইজিং কার্ভ এডিটর)
//
// A real curve editor: 6 preset mini-curves to click, plus a CUSTOM
// cubic-bezier whose two control handles you drag on the big graph —
// same model as CSS cubic-bezier. Deterministic via cubicBezierEase.
// ============================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { EASING_OPTIONS } from "@/lib/cartoon/presets";
import { cubicBezierEase, easingByName } from "@/lib/cartoon/pose";
import type { CustomEasing, EasingName } from "@/lib/cartoon/types";

const PRESETS: EasingName[] = [
  "easeInOut",
  "linear",
  "easeIn",
  "easeOut",
  "backOut",
  "elasticOut",
];

const DEFAULT_CUSTOM: CustomEasing = [0.3, 0.6, 0.7, 0.2];

/** sample an easing into an SVG path (0..100 box, y inverted) */
function curvePath(f: (x: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const x = i / 32;
    const y = Math.max(-0.6, Math.min(1.6, f(x)));
    pts.push(`${(x * 100).toFixed(1)},${(100 - y * 100).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

export default function EasingCurvePicker({
  value,
  custom,
  onChange,
}: {
  value: EasingName;
  custom?: CustomEasing;
  onChange: (easing: EasingName, custom: CustomEasing) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);
  const pts: CustomEasing = custom ?? DEFAULT_CUSTOM;

  const bigPath = useMemo(
    () =>
      curvePath(
        value === "custom"
          ? cubicBezierEase(pts[0], pts[1], pts[2], pts[3])
          : easingByName(value),
      ),
    [value, pts],
  );

  /** client coords → svg 0..100 (y flipped) */
  const toSvg = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = Math.max(-0.4, Math.min(1.4, 1 - (clientY - r.top) / r.height));
    return { x, y };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging == null) return;
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      const next: CustomEasing = [...pts] as CustomEasing;
      next[dragging === 1 ? 0 : 2] = Math.round(p.x * 100) / 100;
      next[dragging === 1 ? 1 : 3] = Math.round(p.y * 100) / 100;
      onChange("custom", next);
    },
    [dragging, pts, onChange, toSvg],
  );

  const endDrag = useCallback(() => setDragging(null), []);

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold text-amber-900">
        📈 গতির গ্রাফ — কার্ভ বাছুন (কাস্টমে হাতল টেনে নিজের গতি বানান)
      </p>

      {/* big interactive graph */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox="-14 -14 128 128"
          className="h-36 w-full touch-none rounded-lg border border-amber-200 bg-white"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          role="img"
          aria-label="ইজিং কার্ভ গ্রাফ"
        >
          {/* grid */}
          {[25, 50, 75].map((g) => (
            <line
              key={`h${g}`}
              x1={0}
              x2={100}
              y1={g}
              y2={g}
              stroke="#fde68a"
              strokeWidth={0.6}
            />
          ))}
          {[25, 50, 75].map((g) => (
            <line
              key={`v${g}`}
              x1={g}
              x2={g}
              y1={0}
              y2={100}
              stroke="#fde68a"
              strokeWidth={0.6}
            />
          ))}
          <line x1={0} x2={100} y1={100} y2={0} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" />

          {/* guide lines from endpoints to control handles */}
          <line x1={0} y1={100} x2={pts[0] * 100} y2={100 - pts[1] * 100} stroke="#fb923c" strokeWidth={0.8} strokeDasharray="2 2" />
          <line x1={100} y1={0} x2={pts[2] * 100} y2={100 - pts[3] * 100} stroke="#fb923c" strokeWidth={0.8} strokeDasharray="2 2" />

          <path d={bigPath} fill="none" stroke="#ea580c" strokeWidth={2.6} strokeLinecap="round" />

          {value === "custom" && (
            <>
              <circle
                cx={pts[0] * 100}
                cy={100 - pts[1] * 100}
                r={5.5}
                fill="#0d9488"
                stroke="#fff"
                strokeWidth={1.6}
                className="cursor-grab"
                onPointerDown={(e) => {
                  const el = e.target as SVGCircleElement;
                  if (el.hasPointerCapture(e.pointerId))
                    el.releasePointerCapture(e.pointerId);
                  setDragging(1);
                }}
                aria-label="কন্ট্রোল পয়েন্ট ১"
              />
              <circle
                cx={pts[2] * 100}
                cy={100 - pts[3] * 100}
                r={5.5}
                fill="#7c3aed"
                stroke="#fff"
                strokeWidth={1.6}
                className="cursor-grab"
                onPointerDown={(e) => {
                  const el = e.target as SVGCircleElement;
                  if (el.hasPointerCapture(e.pointerId))
                    el.releasePointerCapture(e.pointerId);
                  setDragging(2);
                }}
                aria-label="কন্ট্রোল পয়েন্ট ২"
              />
            </>
          )}
          <text x={2} y={8} fontSize={7} fill="#b45309">১০০%</text>
          <text x={78} y={110} fontSize={7} fill="#b45309">সময় →</text>
        </svg>
        <span className="absolute right-2 top-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          {EASING_OPTIONS.find((o) => o.id === value)?.label ?? value}
        </span>
      </div>

      {/* preset chips (mini curves) */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id, pts)}
            className={`rounded-lg border p-1 transition-colors ${
              value === id
                ? "border-orange-600 bg-orange-50"
                : "border-amber-200 bg-white hover:border-amber-400"
            }`}
            title={EASING_OPTIONS.find((o) => o.id === id)?.label}
            aria-label={EASING_OPTIONS.find((o) => o.id === id)?.label}
          >
            <svg viewBox="-10 -18 120 128" className="h-9 w-11">
              <path
                d={curvePath(easingByName(id))}
                fill="none"
                stroke={value === id ? "#ea580c" : "#a8a29e"}
                strokeWidth={4}
              />
            </svg>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("custom", pts)}
          className={`rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
            value === "custom"
              ? "border-orange-600 bg-orange-50 text-orange-800"
              : "border-amber-200 bg-white text-amber-800 hover:border-amber-400"
          }`}
        >
          ✏️ কাস্টম
        </button>
      </div>
    </div>
  );
}
