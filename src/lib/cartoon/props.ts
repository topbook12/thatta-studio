// ============================================================
// ঠাট্টা স্টুডিও — Prop system (Sprint 2)
//
// Props (লাঠি, ছাতা, কলসি, মাছের টোকরি, হাতপাখা) are drawn in the
// near-hand's forward-kinematics frame so they follow every action
// (walk swing, slap windup, wave…) with zero extra animation code.
//
// Hand frame (after translate+rotate to the hand):
//   +y = continuing beyond the fingertips (down the forearm line)
//   −y = back toward the elbow (so "upright" props grow toward −y)
//   +x = forward of the character (roughly)
// ============================================================

import { handXform, D } from './skeleton';
import type { Pose, PropName } from './types';

const OUTLINE = '#4a352b';

function capsule(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
  outline = true,
) {
  ctx.lineCap = 'round';
  if (outline) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = w + 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** small closed ring around the hand (the grip) */
function grip(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------- individual props ----------------

/** লাঠি — bamboo staff, upright with a slight forward lean */
function drawStick(ctx: CanvasRenderingContext2D) {
  ctx.rotate(-14 * D);
  // pole
  capsule(ctx, 0, 14, 0, -74, 6.5, '#b45309');
  // bamboo nodes
  ctx.strokeStyle = '#7c3d0c';
  ctx.lineWidth = 2.2;
  for (const y of [-44, -12, 8]) {
    ctx.beginPath();
    ctx.moveTo(-3.4, y);
    ctx.lineTo(3.4, y);
    ctx.stroke();
  }
  // grip fist over the pole
  grip(ctx, '#eab88a');
}

/** ছাতা — umbrella held on the shoulder-ish angle */
function drawUmbrella(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(-22 * D + Math.sin(t * 1.7) * 1.6 * D);
  // pole
  capsule(ctx, 0, 12, 0, -86, 4.5, '#7c3d0c');
  // curved handle at the bottom
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4.5 + 3;
  ctx.beginPath();
  ctx.arc(4, 12, 5, Math.PI, 0, false);
  ctx.stroke();
  ctx.strokeStyle = '#7c3d0c';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(4, 12, 5, Math.PI, 0, false);
  ctx.stroke();

  // canopy (scalloped dome)
  const cy = -86;
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-34, cy + 8);
  ctx.quadraticCurveTo(-34, cy - 26, 0, cy - 26);
  ctx.quadraticCurveTo(34, cy - 26, 34, cy + 8);
  // scalloped bottom edge
  for (let i = 3; i >= 0; i--) {
    const x0 = i * 17 - 34;
    ctx.quadraticCurveTo(x0 + 8.5, cy + 15, x0 + 17, cy + 8);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // canopy ribs
  ctx.strokeStyle = 'rgba(74,53,43,0.5)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, cy - 26);
  ctx.quadraticCurveTo(-16, cy - 14, -17, cy + 9);
  ctx.moveTo(0, cy - 26);
  ctx.quadraticCurveTo(16, cy - 14, 17, cy + 9);
  ctx.stroke();
  // top nub
  ctx.fillStyle = '#7c3d0c';
  ctx.beginPath();
  ctx.arc(0, cy - 27, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // grip fist on the pole
  grip(ctx, '#eab88a');
}

/** কলসি — clay water pot carried in the hand, gentle pendulum lag */
function drawPot(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.6 + 0.8) * 3.4 * D);
  // belly
  ctx.fillStyle = '#c2691a';
  ctx.beginPath();
  ctx.ellipse(0, 17, 13.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // neck + rim
  ctx.fillStyle = '#d1791f';
  ctx.beginPath();
  ctx.roundRect(-6.5, -2, 13, 10, 3);
  ctx.fill();
  ctx.stroke();
  // decorative band + shine
  ctx.strokeStyle = '#8a4513';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, 14);
  ctx.quadraticCurveTo(0, 19, 11, 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-5, 10, 3.2, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  grip(ctx, '#eab88a');
}

/** মাছের টোকরি — woven fish basket hanging from the hand, tail wiggling */
function drawBasket(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.2 + 1.1) * 4 * D);
  // rope
  capsule(ctx, 0, 0, 0, 15, 2.6, '#8a6a4a');
  // basket body (narrowing trapezoid)
  ctx.fillStyle = '#d9b36c';
  ctx.beginPath();
  ctx.moveTo(-13, 15);
  ctx.lineTo(13, 15);
  ctx.lineTo(9, 44);
  ctx.quadraticCurveTo(0, 49, -9, 44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // weave pattern
  ctx.strokeStyle = 'rgba(122,83,48,0.75)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const y = 22 + i * 8;
    const k = 1 - i * 0.11;
    ctx.beginPath();
    ctx.moveTo(-13 * k + 1.5, y);
    ctx.lineTo(13 * k - 1.5, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-6, 16);
  ctx.lineTo(-4.2, 45);
  ctx.moveTo(6, 16);
  ctx.lineTo(4.2, 45);
  ctx.stroke();
  // rim
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-13, 16);
  ctx.lineTo(13, 16);
  ctx.stroke();

  // fish tail poking out and wiggling
  ctx.save();
  ctx.translate(6, 15);
  ctx.rotate(-0.5 + Math.sin(t * 7) * 0.3);
  ctx.fillStyle = '#0d9488';
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(12, -6);
  ctx.lineTo(9, 0);
  ctx.lineTo(12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** হাতপাখা — round woven hand-fan, lazily self-fanning */
function drawFan(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.3) * 9 * D - 6 * D);
  // handle
  capsule(ctx, 0, 4, 0, -13, 4, '#8a5a2b');
  // round blade
  ctx.fillStyle = '#e8cf9a';
  ctx.beginPath();
  ctx.arc(0, -30, 16.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // radial weave
  ctx.strokeStyle = 'rgba(138,90,43,0.65)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(Math.cos(a) * 15.5, -30 + Math.sin(a) * 15.5);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -30, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(0, -30, 3.4, 0, Math.PI * 2);
  ctx.fill();
  grip(ctx, '#eab88a');
}

// ---------------- entry point ----------------

/**
 * Draw the prop held in the near (right) hand. Must be called while the
 * ctx is in the character-local frame (ground origin), AFTER the arm has
 * been drawn — it re-derives the hand position from the pose.
 */
export function drawProp(
  ctx: CanvasRenderingContext2D,
  prop: PropName,
  pose: Pose,
  t: number,
) {
  if (prop === 'none' || prop == null) return;
  const h = handXform(pose, 'R');
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  switch (prop) {
    case 'stick':
      drawStick(ctx);
      break;
    case 'umbrella':
      drawUmbrella(ctx, t);
      break;
    case 'pot':
      drawPot(ctx, t);
      break;
    case 'basket':
      drawBasket(ctx, t);
      break;
    case 'fan':
      drawFan(ctx, t);
      break;
  }
  ctx.restore();
}
