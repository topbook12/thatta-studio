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

// ---------------- Sprint 4 props ----------------

/** মিষ্টির থালা — plate of laddus held flat on the palm, tempting wobble */
function drawLaddu(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.9) * 4 * D - 8 * D);
  // plate (elliptical, held flat)
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(0, 2, 21, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.3;
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 8, 0, 0, Math.PI);
  ctx.fill();
  // three laddus — round motichoor with boondi texture
  const laddu = (x: number, y: number, r: number) => {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // boondi dots
    ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
    for (const [dx, dy] of [
      [-3, -2],
      [3, 1],
      [0, 3],
      [2, -3],
      [-3, 3],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * r * 0.28, y + dy * r * 0.28, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    // shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.35, r * 0.2, r * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();
  };
  laddu(-10, -7, 8);
  laddu(8, -6.5, 8.5);
  laddu(-1, -13, 7.5);
  grip(ctx, '#eab88a');
}

/** পোথি/বই — palm-leaf book held open, pages flutter */
function drawBook(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 1.9) * 3 * D - 12 * D);
  // open pages (two spread halves)
  const flutter = Math.sin(t * 4.4) * 2;
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(-20, -14);
  ctx.quadraticCurveTo(-10, -17, 0, -13 + flutter * 0.4);
  ctx.lineTo(0, 8);
  ctx.quadraticCurveTo(-10, 12, -20, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -13 + flutter * 0.4);
  ctx.quadraticCurveTo(10, -17, 20, -14 + flutter);
  ctx.lineTo(20 + flutter, 9);
  ctx.quadraticCurveTo(10, 12, 0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // written lines (gopal's grand plan!)
  ctx.strokeStyle = 'rgba(87, 60, 40, 0.6)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-16, -8 + i * 5);
    ctx.lineTo(-4, -8 + i * 5);
    ctx.moveTo(4, -8 + i * 5);
    ctx.lineTo(16, -8 + i * 5);
    ctx.stroke();
  }
  // spine
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(0, 8);
  ctx.stroke();
  grip(ctx, '#eab88a');
}

/** কুপি — hurricane lamp, flame flickers + soft glow */
function drawLamp(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.1) * 3 * D - 4 * D);
  // base + fuel bowl
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(0, 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // glass chimney
  ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-8, 9);
  ctx.quadraticCurveTo(-10, -8, -6, -26);
  ctx.lineTo(6, -26);
  ctx.quadraticCurveTo(10, -8, 8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 72, 20, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // brass cap + loop handle
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.roundRect(-8, -32, 16, 7, 3);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(11, -28, 5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // flickering flame
  const fl = Math.sin(t * 12) * 0.18 + Math.sin(t * 7.3) * 0.1;
  ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.beginPath();
  ctx.ellipse(0, -14 + fl, 3.4, 7.5 + fl * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
  ctx.beginPath();
  ctx.ellipse(0, -12 + fl, 1.6, 3.6 + fl * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // warm glow halo
  const gl = ctx.createRadialGradient(0, -14, 4, 0, -14, 46);
  gl.addColorStop(0, `rgba(251, 191, 36, ${0.28 + fl * 0.12})`);
  gl.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(0, -14, 46, 0, Math.PI * 2);
  ctx.fill();
  grip(ctx, '#eab88a');
}

/** বস্তা — jute sack slung from the hand, bulges with loot */
function drawSack(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.4 + 0.5) * 5 * D);
  // rope tie around the neck
  capsule(ctx, 0, 0, 0, 10, 2.6, '#8a6a4a');
  // bulging body
  ctx.fillStyle = '#d6b25e';
  ctx.beginPath();
  ctx.moveTo(-11, 10);
  ctx.quadraticCurveTo(-19, 30, -11, 44);
  ctx.quadraticCurveTo(0, 54, 11, 44);
  ctx.quadraticCurveTo(19, 30, 11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // jute weave cross-lines
  ctx.strokeStyle = 'rgba(146, 106, 54, 0.6)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const y = 20 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-16 + i, y);
    ctx.lineTo(16 - i, y);
    ctx.stroke();
  }
  // tied neck knot
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-7, 10);
  ctx.quadraticCurveTo(0, 15, 7, 10);
  ctx.stroke();
  // a laddu peeking from the top (of course!)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(2, 6, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  grip(ctx, '#eab88a');
}

/** ফুলের তোড়া — garland bunch of marigolds & hibiscus */
function drawFlower(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.6) * 6 * D - 6 * D);
  // stem binding
  capsule(ctx, 0, 0, 0, -12, 3, '#4d7c0f');
  // bloom cluster
  const bloom = (x: number, y: number, r: number, c: string) => {
    ctx.fillStyle = c;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.44, r * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  };
  bloom(-8, -22, 8, '#f97316'); // marigold
  bloom(7, -26, 7.5, '#dc2626'); // hibiscus
  bloom(0, -36, 7, '#f59e0b');
  bloom(-13, -33, 6, '#dc2626');
  bloom(11, -37, 5.5, '#f97316');
  // leaves poking out
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(-12, -12, 8, 3.6, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -14, 8, 3.6, 0.7, 0, Math.PI * 2);
  ctx.fill();
  grip(ctx, '#eab88a');
}

// ---------------- Phase 5 props ----------------

/** চায়ের কাপ — steaming clay cup (মাটির কাপ), held level so the tea won't spill */
function drawTea(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.2) * 3 * D - 10 * D);
  // clay cup body (matir cup — small trapezoid cup)
  ctx.fillStyle = '#c2691a';
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.quadraticCurveTo(-12, 6, -8, 12);
  ctx.lineTo(8, 12);
  ctx.quadraticCurveTo(12, 6, 10, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.3;
  ctx.stroke();
  // tea surface
  ctx.fillStyle = '#8a4b12';
  ctx.beginPath();
  ctx.ellipse(0, -11, 8.6, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-3, -11.5, 3, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // rising steam (two lazy swirls, deterministic)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (const [dx, ph] of [[-3, 0], [3, 2.1]] as const) {
    const sway = Math.sin(t * 3.4 + ph) * 3.5;
    const lift = ((t * 26 + ph * 14) % 26);
    ctx.globalAlpha = Math.max(0, 0.65 - lift / 26);
    ctx.beginPath();
    ctx.moveTo(dx, -16);
    ctx.quadraticCurveTo(dx + sway - 3, -16 - lift * 0.5, dx + sway, -16 - lift);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  grip(ctx, '#eab88a');
}

/** মোবাইল — smartphone in hand, screen glowing with a chat bubble */
function drawMobile(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 1.8) * 2.5 * D - 26 * D);
  // body
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(-9.5, -26, 19, 38, 4.5);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // glowing screen (deterministic pulse — someone texted!)
  const glow = 0.75 + Math.sin(t * 5) * 0.1 + Math.sin(t * 2.3) * 0.08;
  ctx.fillStyle = `rgba(186, 230, 253, ${glow})`;
  ctx.beginPath();
  ctx.roundRect(-7.5, -23.5, 15, 32, 3);
  ctx.fill();
  // chat bubbles on the screen
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(-6, -20, 9, 5, 2.4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.roundRect(-4, -12, 10, 5, 2.4);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(-6, -4, 8, 5, 2.4);
  ctx.fill();
  // camera notch
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, -22.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  grip(ctx, '#eab88a');
}

/** ঝোলা — cloth shoulder bag hanging from the hand, jingle at the sway */
function drawBag(ctx: CanvasRenderingContext2D, t: number) {
  ctx.rotate(Math.sin(t * 2.5 + 0.9) * 5 * D);
  // straps (double rope loop)
  capsule(ctx, 0, 0, 0, 10, 2.4, '#b45309');
  // cloth body (soft rectangle with sag)
  ctx.fillStyle = '#e0662a';
  ctx.beginPath();
  ctx.moveTo(-12, 10);
  ctx.quadraticCurveTo(-15, 26, -12, 42);
  ctx.quadraticCurveTo(0, 48, 12, 42);
  ctx.quadraticCurveTo(15, 26, 12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // woven border stripe
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11.5, 16);
  ctx.quadraticCurveTo(0, 20, 11.5, 16);
  ctx.stroke();
  // tassel
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  const sw = Math.sin(t * 6) * 2.2;
  ctx.beginPath();
  ctx.moveTo(8, 42);
  ctx.quadraticCurveTo(9 + sw, 47, 8 + sw, 52);
  ctx.stroke();
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
    case 'laddu':
      drawLaddu(ctx, t);
      break;
    case 'book':
      drawBook(ctx, t);
      break;
    case 'lamp':
      drawLamp(ctx, t);
      break;
    case 'sack':
      drawSack(ctx, t);
      break;
    case 'flower':
      drawFlower(ctx, t);
      break;
    case 'tea':
      drawTea(ctx, t);
      break;
    case 'mobile':
      drawMobile(ctx, t);
      break;
    case 'bag':
      drawBag(ctx, t);
      break;
  }
  ctx.restore();
}
