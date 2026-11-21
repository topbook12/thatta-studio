// ============================================================
// ঠাট্টা স্টুডিও — Phase 5: ডেকোর লেয়ার (set decorations)
//
// Ground-anchored set pieces the user can place freely: গাছ,
// রিকশা, চেয়ার, মেলার দোকান. Drawn in the world frame with the
// ground origin at (0,0) — the same convention as characters —
// so the engine can depth-sort and parallax them for free.
//
// Decor with z >= 0 renders BEHIND the actors, z < 0 in FRONT.
// ============================================================

import { D } from './skeleton';
import type { DecorName } from './types';

const OUTLINE = '#3f2d20';

const DECOR_META: Record<
  DecorName,
  { label: string; emoji: string; w: number; h: number }
> = {
  tree: { label: 'গাছ', emoji: '🌳', w: 120, h: 250 },
  rickshaw: { label: 'রিকশা', emoji: '🛺', w: 150, h: 130 },
  chair: { label: 'চেয়ার', emoji: '🪑', w: 90, h: 100 },
  stall: { label: 'মেলার দোকান', emoji: '🎪', w: 170, h: 190 },
};

export function decorMetaOf(id: DecorName) {
  return DECOR_META[id];
}

export const DECOR_IDS = Object.keys(DECOR_META) as DecorName[];

/** contact shadow ellipse under the piece */
function baseShadow(ctx: CanvasRenderingContext2D, rx: number) {
  ctx.fillStyle = 'rgba(30, 20, 8, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, rx, rx * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stroked(ctx: CanvasRenderingContext2D, lw = 2.6) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** বড় গাছ — leafy village tree with layered canopy + swinging top */
function drawTree(ctx: CanvasRenderingContext2D, t: number) {
  const sway = Math.sin(t * 1.1) * 2.4;
  baseShadow(ctx, 52);
  // trunk (slight curve, root flare)
  ctx.fillStyle = '#7c4a21';
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.quadraticCurveTo(-9, -70, -6 + sway * 0.3, -130);
  ctx.lineTo(6 + sway * 0.3, -130);
  ctx.quadraticCurveTo(9, -70, 13, 0);
  ctx.closePath();
  ctx.fill();
  stroked(ctx, 2.8);
  // bark lines
  ctx.strokeStyle = 'rgba(60, 34, 12, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -16);
  ctx.quadraticCurveTo(-2, -60, -2 + sway * 0.2, -100);
  ctx.moveTo(4, -12);
  ctx.quadraticCurveTo(3, -50, 3 + sway * 0.2, -90);
  ctx.stroke();
  // branch
  ctx.strokeStyle = '#7c4a21';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-2 + sway * 0.2, -108);
  ctx.quadraticCurveTo(-22, -124, -34 + sway * 0.5, -140);
  ctx.stroke();
  // canopy — three blobby crowns that breathe with the sway
  const crown = (cx: number, cy: number, r: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx + sway, cy, r, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.75 + sway, cy + r * 0.4, r * 0.72, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.75 + sway, cy + r * 0.42, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    stroked(ctx, 2.6);
  };
  crown(sway, -158, 40, '#2f7d32');
  crown(-30 + sway * 0.8, -138, 26, '#3a923c');
  crown(32 + sway * 0.8, -136, 24, '#357a35');
  // leaf highlights
  ctx.fillStyle = 'rgba(163, 230, 53, 0.5)';
  for (const [dx, dy] of [
    [-12, -172],
    [16, -166],
    [-34, -148],
    [40, -146],
    [0, -190],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(dx + sway, dy, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** সাইকেল রিকশা — hood + spoked wheels + pedalling leg shimmer */
function drawRickshaw(ctx: CanvasRenderingContext2D, t: number) {
  baseShadow(ctx, 62);
  const wheel = (cx: number, cy: number, r: number) => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70, 50, 35, 0.75)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) {
      const a = t * 1.4 + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70, 50, 35, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
    ctx.fill();
  };
  // frame bar
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-58, -34);
  ctx.lineTo(48, -34);
  ctx.stroke();
  // hood (folding canopy)
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.moveTo(-6, -110);
  ctx.quadraticCurveTo(34, -118, 52, -78);
  ctx.quadraticCurveTo(28, -86, -2, -84);
  ctx.closePath();
  ctx.fill();
  stroked(ctx, 2.8);
  // hood ribs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, -106);
  ctx.lineTo(20, -84);
  ctx.moveTo(30, -104);
  ctx.lineTo(38, -80);
  ctx.stroke();
  // seat back
  ctx.fillStyle = '#155e75';
  ctx.beginPath();
  ctx.roundRect(-18, -78, 30, 34, 6);
  ctx.fill();
  stroked(ctx, 2.4);
  // wheels — big front, small rear
  wheel(-52, -30, 30);
  wheel(50, -26, 22);
  // pedal crank hint
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 3.4;
  const pa = t * 1.4;
  ctx.beginPath();
  ctx.moveTo(-52 + Math.cos(pa) * 9, -30 + Math.sin(pa) * 9);
  ctx.lineTo(-52 - Math.cos(pa) * 9, -30 - Math.sin(pa) * 9);
  ctx.stroke();
  // handlebar
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-76, -56);
  ctx.quadraticCurveTo(-64, -66, -52, -56);
  ctx.stroke();
}

/** কাঠের চেয়ার — simple wooden chair */
function drawChair(ctx: CanvasRenderingContext2D) {
  baseShadow(ctx, 34);
  ctx.fillStyle = '#a16207';
  // back posts + slats
  ctx.beginPath();
  ctx.roundRect(-26, -92, 8, 92, 3);
  ctx.fill();
  stroked(ctx, 2.4);
  ctx.beginPath();
  ctx.roundRect(18, -92, 8, 92, 3);
  ctx.fill();
  stroked(ctx, 2.4);
  ctx.fillStyle = '#b45309';
  for (const y of [-88, -72, -56]) {
    ctx.beginPath();
    ctx.roundRect(-26, y, 52, 10, 3);
    ctx.fill();
    stroked(ctx, 2.2);
  }
  // seat
  ctx.fillStyle = '#c27409';
  ctx.beginPath();
  ctx.roundRect(-30, -44, 60, 12, 4);
  ctx.fill();
  stroked(ctx, 2.6);
  // legs
  ctx.fillStyle = '#7c2d12';
  for (const lx of [-28, 20]) {
    ctx.beginPath();
    ctx.roundRect(lx, -34, 8, 34, 2.5);
    ctx.fill();
    stroked(ctx, 2.2);
  }
}

/** মেলার দোকান — striped canopy stall with jars & garland, light twinkle */
function drawStall(ctx: CanvasRenderingContext2D, t: number) {
  baseShadow(ctx, 70);
  // counter
  ctx.fillStyle = '#8a5a2b';
  ctx.beginPath();
  ctx.roundRect(-80, -78, 160, 78, 6);
  ctx.fill();
  stroked(ctx, 2.8);
  // counter top
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.roundRect(-86, -84, 172, 12, 4);
  ctx.fill();
  stroked(ctx, 2.4);
  // jars on the counter (মিষ্টি!)
  const jar = (jx: number, c: string) => {
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.beginPath();
    ctx.roundRect(jx - 9, -106, 18, 22, 3);
    ctx.fill();
    stroked(ctx, 2);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(jx, -92, 6.4, 0, Math.PI * 2);
    ctx.fill();
  };
  jar(-46, '#f59e0b');
  jar(-14, '#dc2626');
  jar(18, '#f97316');
  // posts
  ctx.fillStyle = '#7c4a21';
  for (const px of [-76, 62]) {
    ctx.beginPath();
    ctx.roundRect(px, -186, 9, 104, 3);
    ctx.fill();
    stroked(ctx, 2.4);
  }
  // striped canopy (sagging cloth)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-92, -186);
  ctx.quadraticCurveTo(0, -206, 92, -186);
  ctx.lineTo(84, -156);
  ctx.quadraticCurveTo(0, -172, -84, -156);
  ctx.closePath();
  ctx.fill();
  stroked(ctx, 2.8);
  // white stripes
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = -2; i <= 2; i++) {
    const x = i * 34;
    ctx.beginPath();
    ctx.moveTo(x, -196 + Math.abs(i) * 1.5);
    ctx.lineTo(x + 13, -193 + Math.abs(i) * 1.5);
    ctx.lineTo(x + 11, -164);
    ctx.lineTo(x - 2, -166);
    ctx.closePath();
    ctx.fill();
  }
  // marigold garland with a gentle sway
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 7; i++) {
    const gx = -60 + i * 20;
    const gy = -150 + Math.sin(i * 1.1) * 5 + Math.sin(t * 2 + i) * 1.6;
    ctx.fillStyle = i % 2 ? '#f97316' : '#dc2626';
    ctx.beginPath();
    ctx.arc(gx, gy, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // fairy-light twinkle on the canopy edge
  for (let i = 0; i < 6; i++) {
    const lx = -78 + i * 30;
    const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
    ctx.fillStyle = `rgba(253, 224, 71, ${0.35 + tw * 0.55})`;
    ctx.beginPath();
    ctx.arc(lx, -158 + Math.sin(i) * 4, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw one decor piece in the WORLD frame (ground origin at 0,0).
 * `t` is the scene/anim time — everything is deterministic for export.
 */
export function drawDecor(
  ctx: CanvasRenderingContext2D,
  decorId: DecorName,
  t: number,
) {
  switch (decorId) {
    case 'tree':
      drawTree(ctx, t);
      break;
    case 'rickshaw':
      drawRickshaw(ctx, t);
      break;
    case 'chair':
      drawChair(ctx);
      break;
    case 'stall':
      drawStall(ctx, t);
      break;
  }
}
