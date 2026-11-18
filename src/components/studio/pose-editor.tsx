"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 3: কাস্টম পোজ এডিটর
//
// Per-beat joint fine-tuning: body lean, head tilt, both shoulders &
// elbows, height. The live mini-canvas animates the REAL character in
// the REAL pose pipeline (computePose → blend → offsets) so what you
// tune is exactly what plays and what exports.
// ============================================================

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/store";
import { applyPoseOffsets, basePose, computePose } from "@/lib/cartoon/pose";
import { drawCharacter } from "@/lib/cartoon/draw";
import type { CharacterDesign, PoseOffset } from "@/lib/cartoon/types";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

interface JointSpec {
  key: keyof PoseOffset;
  label: string;
  min: number;
  max: number;
  step: number;
}

const JOINTS: JointSpec[] = [
  { key: "bodyLean", label: "শরীরের ঝুঁকি", min: -0.6, max: 0.6, step: 0.02 },
  { key: "headTilt", label: "মাথার কাত", min: -0.8, max: 0.8, step: 0.02 },
  { key: "shoulderR", label: "ডান কাঁধ", min: -1, max: 1, step: 0.05 },
  { key: "elbowR", label: "ডান কনুই", min: -1.2, max: 1.2, step: 0.05 },
  { key: "shoulderL", label: "বাম কাঁধ", min: -1, max: 1, step: 0.05 },
  { key: "elbowL", label: "বাম কনুই", min: -1.2, max: 1.2, step: 0.05 },
  { key: "yOff", label: "উচ্চতা (লাফ/বসা)", min: -24, max: 48, step: 2 },
];

export default function PoseEditor({
  design,
  action,
  value,
  onChange,
}: {
  /** whose body is being posed (undefined → first cast member) */
  design: CharacterDesign | undefined;
  /** the beat's primary action, so the offsets preview on top of it */
  action: string;
  value: PoseOffset | undefined;
  onChange: (po: PoseOffset | undefined) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const designs = useStudio((s) => s.designs);
  const resolved = design ?? designs[0];

  // live preview loop — same render pipeline as the stage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 240;
    const H = 170;
    canvas.width = W * 2; // HiDPI
    canvas.height = H * 2;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      t += dt;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // mini stage
      ctx.fillStyle = "#fffbeb";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fcd34d";
      ctx.fillRect(0, H - 26, W, 26);
      ctx.fillStyle = "#b45309";
      ctx.font = '600 10px "Hind Siliguri", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText("প্রিভিউ (সত্যিকারের পাইপলাইন)", 8, 14);

      if (!resolved) return;
      let pose = computePose(action as never, t, false);
      if (value) pose = applyPoseOffsets(pose, value);
      ctx.save();
      ctx.translate(W / 2, H - 26);
      ctx.scale(0.62, 0.62);
      drawCharacter(ctx, resolved, pose, t, "none", "0,0,0");
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resolved, action, value]);

  const get = (k: keyof PoseOffset) => value?.[k] ?? 0;
  const set = (k: keyof PoseOffset, v: number) => {
    const next: PoseOffset = { ...(value ?? {}), [k]: v };
    const any = Object.values(next).some((x) => typeof x === "number" && Math.abs(x) > 0.001);
    onChange(any ? next : undefined);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
      <div className="space-y-1.5">
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg border border-amber-300"
          style={{ aspectRatio: "240/170" }}
          aria-label="পোজ প্রিভিউ"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full border-amber-300 text-xs"
          onClick={() => onChange(undefined)}
        >
          ↺ সব জয়েন্ট রিসেট
        </Button>
      </div>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {JOINTS.map((j) => (
          <div key={j.key}>
            <div className="mb-0.5 flex justify-between text-[11px] text-amber-800">
              <span>{j.label}</span>
              <span className="font-semibold text-orange-700">
                {bnNum(Number(get(j.key).toFixed(2)))}
              </span>
            </div>
            <Slider
              value={[get(j.key)]}
              min={j.min}
              max={j.max}
              step={j.step}
              onValueChange={(v) => set(j.key, v[0])}
              aria-label={j.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
