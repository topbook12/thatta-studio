// ============================================================
// ঠাট্টা স্টুডিও — Character renderer (flat cutout style, Canvas 2D)
//
// Local coordinate system: ground at y=0, character faces +x,
// height ≈ 200 units. The caller sets translation/scale/flip.
// ============================================================

import type { CharacterDesign, FaceFx, Pose, PropName } from './types';
import {
  BROW_Y,
  D,
  EYE_LX,
  EYE_RX,
  EYE_Y,
  FOREARM,
  HEAD_CY,
  HEAD_CX,
  HEAD_R,
  HIP_LX,
  HIP_RX,
  HIP_Y,
  MOUTH_X,
  MOUTH_Y,
  SHOULDER_LX,
  SHOULDER_RX,
  SHOULDER_Y,
  SHIN,
  THIGH,
  UPPER_ARM,
  handXform,
} from './skeleton';
import { drawProp } from './props';

/** consistent cartoon outline color */
const OUTLINE = '#4a352b';

// ---------------- small helpers ----------------

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  r = f(r);
  g = f(g);
  b = f(b);
  return `rgb(${r},${g},${b})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
    ctx.lineWidth = w + 3.4;
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

function outlinedCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- limbs ----------------

function drawArm(
  ctx: CanvasRenderingContext2D,
  jx: number,
  jy: number,
  shoulder: number,
  elbow: number,
  upperColor: string,
  foreColor: string,
  fist = false,
) {
  ctx.save();
  ctx.translate(jx, jy);
  ctx.rotate(-shoulder * D);
  capsule(ctx, 0, 0, 0, UPPER_ARM, 11, upperColor);
  ctx.translate(0, UPPER_ARM);
  ctx.rotate(elbow * D);
  capsule(ctx, 0, 0, 0, FOREARM, 9, foreColor);
  // hand — open or gripping fist (grip reads stronger for action beats)
  outlinedCircle(ctx, 0, FOREARM + 2, fist ? 7.6 : 6, foreColor);
  if (fist) {
    ctx.strokeStyle = 'rgba(74,53,43,0.55)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.2, FOREARM + 3.4);
    ctx.lineTo(3.2, FOREARM + 3.4);
    ctx.moveTo(-2.6, FOREARM + 6.2);
    ctx.lineTo(2.6, FOREARM + 6.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hip: number,
  knee: number,
  thighColor: string,
  shinColor: string,
  shoeColor: string | null,
) {
  ctx.save();
  ctx.translate(hipX, HIP_Y);
  ctx.rotate(-hip * D);
  capsule(ctx, 0, 0, 0, THIGH, 14, thighColor);
  ctx.translate(0, THIGH);
  ctx.rotate(knee * D);
  capsule(ctx, 0, 0, 0, SHIN, 12, shinColor);
  ctx.save();
  ctx.translate(0, SHIN - 2);
  ctx.fillStyle = shoeColor ?? shade(shinColor, -0.22);
  ctx.beginPath();
  ctx.ellipse(5, 2, 11, 6, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawBottom(
  ctx: CanvasRenderingContext2D,
  d: CharacterDesign,
  pose: Pose,
) {
  const skinDk = shade(d.skin, -0.18);
  switch (d.bottomStyle) {
    case 0: // প্যান্ট
      drawLeg(ctx, HIP_LX, pose.hipL, pose.kneeL, d.bottomColor, d.bottomColor, '#3f3f46');
      drawLeg(ctx, HIP_RX, pose.hipR, pose.kneeR, d.bottomColor, d.bottomColor, '#3f3f46');
      break;
    case 1: {
      // লুঙ্গি
      drawLeg(ctx, HIP_LX, pose.hipL, pose.kneeL, d.skin, d.skin, null);
      drawLeg(ctx, HIP_RX, pose.hipR, pose.kneeR, d.skin, d.skin, null);
      const sway = Math.sin(pose.hipL * D) * 3;
      ctx.fillStyle = d.bottomColor;
      ctx.beginPath();
      ctx.moveTo(-14, HIP_Y - 6);
      ctx.lineTo(14, HIP_Y - 6);
      ctx.lineTo(19 + sway, HIP_Y + 46);
      ctx.lineTo(-19 + sway, HIP_Y + 46);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(d.bottomColor, -0.22);
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 9, HIP_Y - 4);
        ctx.lineTo(i * 11 + sway, HIP_Y + 44);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(d.bottomColor, -0.35);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18 + sway, HIP_Y + 44);
      ctx.lineTo(18 + sway, HIP_Y + 44);
      ctx.stroke();
      break;
    }
    case 2: // পায়জামা
      drawLeg(ctx, HIP_LX, pose.hipL, pose.kneeL, d.bottomColor, d.bottomColor, d.bottomColor);
      drawLeg(ctx, HIP_RX, pose.hipR, pose.kneeR, d.bottomColor, d.bottomColor, d.bottomColor);
      ctx.strokeStyle = shade(d.bottomColor, -0.4);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-11, HIP_Y + 2);
      ctx.lineTo(11, HIP_Y + 2);
      ctx.stroke();
      circle(ctx, 0, HIP_Y + 5, 2.6, shade(d.bottomColor, -0.4));
      break;
    case 3: {
      // স্কার্ট
      drawLeg(ctx, HIP_LX, pose.hipL, pose.kneeL, d.skin, d.skin, '#3f3f46');
      drawLeg(ctx, HIP_RX, pose.hipR, pose.kneeR, d.skin, d.skin, '#3f3f46');
      ctx.fillStyle = d.bottomColor;
      ctx.beginPath();
      ctx.moveTo(-13, HIP_Y - 6);
      ctx.lineTo(13, HIP_Y - 6);
      ctx.quadraticCurveTo(24, HIP_Y + 22, 27, HIP_Y + 50);
      ctx.lineTo(-27, HIP_Y + 50);
      ctx.quadraticCurveTo(-24, HIP_Y + 22, -13, HIP_Y - 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(d.bottomColor, -0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, HIP_Y + 4);
      ctx.quadraticCurveTo(-14, HIP_Y + 26, -17, HIP_Y + 48);
      ctx.moveTo(8, HIP_Y + 4);
      ctx.quadraticCurveTo(14, HIP_Y + 26, 17, HIP_Y + 48);
      ctx.stroke();
      break;
    }
    default:
      drawLeg(ctx, HIP_LX, pose.hipL, pose.kneeL, skinDk, skinDk, null);
      drawLeg(ctx, HIP_RX, pose.hipR, pose.kneeR, skinDk, skinDk, null);
  }
}

// ---------------- torso ----------------

function drawTorso(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  const dark = shade(d.topColor, -0.25);
  switch (d.topStyle) {
    case 1: {
      // পাঞ্জাবি (long kurta)
      ctx.fillStyle = d.topColor;
      ctx.beginPath();
      ctx.moveTo(-21, -150);
      ctx.quadraticCurveTo(-27, -120, -26, -70);
      ctx.lineTo(26, -70);
      ctx.quadraticCurveTo(27, -120, 21, -150);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // subtle side shading
      ctx.save();
      ctx.clip();
      const g1 = ctx.createLinearGradient(-26, 0, 26, 0);
      g1.addColorStop(0, 'rgba(255,255,255,0.14)');
      g1.addColorStop(0.55, 'rgba(255,255,255,0)');
      g1.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g1;
      ctx.fillRect(-30, -155, 60, 90);
      ctx.restore();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -148);
      ctx.lineTo(6, -132);
      ctx.moveTo(0, -148);
      ctx.lineTo(-6, -132);
      ctx.stroke();
      for (let i = 0; i < 3; i++) circle(ctx, 2, -126 + i * 14, 1.8, dark);
      break;
    }
    case 2: // শার্ট
      ctx.fillStyle = d.topColor;
      rr(ctx, -23, -148, 46, 62, 10);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.fillStyle = shade(d.topColor, 0.25);
      ctx.beginPath();
      ctx.moveTo(-6, -148);
      ctx.lineTo(0, -138);
      ctx.lineTo(-12, -132);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -148);
      ctx.lineTo(0, -138);
      ctx.lineTo(12, -132);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -128);
      ctx.lineTo(16, -128);
      ctx.lineTo(16, -114);
      ctx.lineTo(6, -114);
      ctx.closePath();
      ctx.stroke();
      break;
    case 3: {
      // কুর্তি
      ctx.fillStyle = d.topColor;
      ctx.beginPath();
      ctx.moveTo(-20, -150);
      ctx.quadraticCurveTo(-30, -118, -29, -62);
      ctx.lineTo(29, -62);
      ctx.quadraticCurveTo(30, -118, 20, -150);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const g2 = ctx.createLinearGradient(-29, 0, 29, 0);
      g2.addColorStop(0, 'rgba(255,255,255,0.15)');
      g2.addColorStop(0.55, 'rgba(255,255,255,0)');
      g2.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g2;
      ctx.fillRect(-32, -155, 64, 98);
      ctx.restore();
      ctx.strokeStyle = shade(d.topColor, -0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -146);
      ctx.lineTo(0, -128);
      ctx.stroke();
      circle(ctx, 0, -124, 2.6, shade(d.topColor, -0.3));
      break;
    }
    case 4: // ভেস্ট
      ctx.fillStyle = d.skin;
      rr(ctx, -22, -148, 44, 60, 12);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.fillStyle = d.topColor;
      ctx.beginPath();
      ctx.moveTo(-23, -148);
      ctx.lineTo(-3, -148);
      ctx.lineTo(-3, -90);
      ctx.lineTo(-23, -90);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(23, -148);
      ctx.lineTo(3, -148);
      ctx.lineTo(3, -90);
      ctx.lineTo(23, -90);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = shade(d.topColor, -0.25);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-3, -146);
      ctx.lineTo(3, -146);
      ctx.stroke();
      break;
    default: // টি-শার্ট
      ctx.fillStyle = d.topColor;
      rr(ctx, -23, -148, 46, 62, 14);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const g0 = ctx.createLinearGradient(-23, 0, 23, 0);
      g0.addColorStop(0, 'rgba(255,255,255,0.14)');
      g0.addColorStop(0.55, 'rgba(255,255,255,0)');
      g0.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g0;
      ctx.fillRect(-26, -152, 52, 70);
      ctx.restore();
      ctx.strokeStyle = shade(d.topColor, -0.18);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -148);
      ctx.quadraticCurveTo(0, -140, 8, -148);
      ctx.stroke();
  }
  // waist line
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, HIP_Y - 2);
  ctx.lineTo(20, HIP_Y - 2);
  ctx.stroke();
}

// ---------------- head & face ----------------

function drawHairBack(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  if (d.hairStyle === 4) {
    // লম্বা চুল (behind head)
    ctx.fillStyle = d.hairColor;
    ctx.beginPath();
    ctx.moveTo(-HEAD_R - 2, HEAD_CY - 12);
    ctx.quadraticCurveTo(-HEAD_R - 8, HEAD_CY + 30, -HEAD_R - 4, HEAD_CY + 46);
    ctx.lineTo(HEAD_R + 4, HEAD_CY + 46);
    ctx.quadraticCurveTo(HEAD_R + 8, HEAD_CY + 30, HEAD_R + 2, HEAD_CY - 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHair(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  const hc = d.hairColor;
  const topY = HEAD_CY - HEAD_R;
  ctx.fillStyle = hc;
  switch (d.hairStyle) {
    case 0: // টাক
      ctx.strokeStyle = hc;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-HEAD_R + 4, HEAD_CY - 6, 6, 0.5, 2.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(HEAD_R - 4, HEAD_CY - 6, 6, 0.7, 2.6);
      ctx.stroke();
      break;
    case 1: // ছোট চুল
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 1, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(HEAD_CX + 12, HEAD_CY - HEAD_R + 4, HEAD_CX - 8, topY + 8);
      ctx.closePath();
      ctx.fill();
      break;
    case 2: {
      // কাঁকানো (spiky)
      ctx.beginPath();
      ctx.moveTo(-HEAD_R, HEAD_CY - 8);
      const spikes = 6;
      for (let i = 0; i <= spikes; i++) {
        const x = -HEAD_R + (i * (HEAD_R * 2)) / spikes;
        const baseY = topY + 6 + Math.abs(i - spikes / 2) * 2;
        const sx = -HEAD_R + ((i + 0.5) * (HEAD_R * 2)) / spikes;
        ctx.lineTo(sx, baseY - 12);
        ctx.lineTo(x, baseY);
      }
      ctx.quadraticCurveTo(0, HEAD_CY - HEAD_R - 2, -HEAD_R, HEAD_CY - 8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 3: // মাঝ বিভক্ত
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 1, Math.PI * 1.0, Math.PI * 2.0);
      ctx.quadraticCurveTo(HEAD_CX + 8, HEAD_CY - HEAD_R + 6, HEAD_CX + 4, topY + 4);
      ctx.quadraticCurveTo(HEAD_CX, HEAD_CY - HEAD_R + 14, HEAD_CX - 4, topY + 4);
      ctx.quadraticCurveTo(HEAD_CX - 8, HEAD_CY - HEAD_R + 6, HEAD_CX - HEAD_R - 1, HEAD_CY - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 4: // লম্বা — সামনের ফ্রিঞ্জ
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 1, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(HEAD_CX + 14, HEAD_CY - HEAD_R + 8, HEAD_CX + 10, topY + 16);
      ctx.quadraticCurveTo(HEAD_CX - 6, HEAD_CY - HEAD_R + 12, HEAD_CX - 14, topY + 12);
      ctx.closePath();
      ctx.fill();
      break;
    case 5: // খোপা
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 2, HEAD_R + 1, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      circle(ctx, HEAD_CX, topY - 7, 10, hc);
      circle(ctx, HEAD_CX, topY - 7, 5, shade(hc, -0.25));
      break;
  }
}

function drawBeard(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  const c = d.hairColor;
  if (d.beardStyle === 1 || d.beardStyle === 3) {
    // গোঁফ
    ctx.strokeStyle = c;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-5, MOUTH_Y - 9, 6, Math.PI * 1.15, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, MOUTH_Y - 9, 6, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  }
  if (d.beardStyle === 2 || d.beardStyle === 3) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(HEAD_CX, HEAD_CY + 4, HEAD_R + 1, 0.45, Math.PI - 0.45);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, d: CharacterDesign, pose: Pose) {
  const st = pose.eyeState;
  const drawEye = (x: number) => {
    if (st === 'blink' || st === 'closed') {
      ctx.strokeStyle = '#3b2f2a';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, EYE_Y + 3, 6, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
      return;
    }
    if (st === 'happy') {
      ctx.strokeStyle = '#3b2f2a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, EYE_Y + 4, 6.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      return;
    }
    const big = d.eyeStyle === 3;
    const r = d.eyeStyle === 2 ? 4.5 : big ? 9.5 : d.eyeStyle === 1 ? 6.5 : 7.5;
    const ry = d.eyeStyle === 2 ? 3.5 : big ? 9.5 : d.eyeStyle === 1 ? 8 : 7.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, EYE_Y, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const pr = d.eyeStyle === 2 ? 2.2 : big ? 4.4 : 3.2;
    circle(ctx, x + 1.5, EYE_Y + 0.5, pr, '#2b2118');
    circle(ctx, x + 2.8, EYE_Y - 1.8, pr * 0.35, '#ffffff');
  };
  drawEye(EYE_LX);
  drawEye(EYE_RX);
}

function drawBrows(ctx: CanvasRenderingContext2D, pose: Pose, d: CharacterDesign) {
  const w = d.browStyle === 1 ? 5 : 3.2;
  ctx.strokeStyle = d.hairColor;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  const yBase = pose.browState === 'raised' ? BROW_Y - 4 : BROW_Y;
  const drawBrow = (x: number, sign: number) => {
    ctx.save();
    ctx.translate(x, yBase);
    if (pose.browState === 'angry') ctx.rotate(sign * 0.35);
    if (pose.browState === 'sad') ctx.rotate(-sign * 0.35);
    ctx.beginPath();
    ctx.moveTo(-7, 1);
    ctx.quadraticCurveTo(0, -3, 7, 1);
    ctx.stroke();
    ctx.restore();
  };
  drawBrow(EYE_LX, -1);
  drawBrow(EYE_RX, 1);
}

function drawNose(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  ctx.strokeStyle = shade(d.skin, -0.35);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(2, HEAD_CY + 2, 4.5, Math.PI * 1.15, Math.PI * 1.9);
  ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, d: CharacterDesign, pose: Pose) {
  const open = Math.max(0, Math.min(1, pose.mouthOpen));
  // viseme widening: 0 = round “a/o” shape, 1 = stretched “e/i” grin (Sprint 5)
  const wide = Math.max(0, Math.min(1, pose.mouthWide ?? 0));
  const x = MOUTH_X;
  const y = MOUTH_Y;
  ctx.lineCap = 'round';

  if (open > 0.2 || pose.expression === 'laugh') {
    // widen horizontally with the “ee” viseme, narrow toward an “o” shape
    const baseRx = pose.expression === 'laugh' ? 13 : 8 + 4 * open;
    const rx = Math.max(5, baseRx + wide * 5 - (1 - wide) * open * 2);
    const ry = pose.expression === 'laugh' ? 11 : 3 + 10 * open;
    ctx.fillStyle = '#8c2f39';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 + ry * 0.55, rx * 0.62, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // upper teeth strip for wide visemes — reads as “eee!”
    if (wide > 0.55 && open > 0.25 && pose.expression !== 'laugh') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(x - rx * 0.75, y + 2 - ry * 0.92, rx * 1.5, ry * 0.42, 2);
      ctx.fill();
    }
    return;
  }

  ctx.strokeStyle = '#5b3a34';
  ctx.lineWidth = 2.8;
  switch (pose.expression) {
    case 'frown':
    case 'angry':
      ctx.beginPath();
      ctx.arc(x, y + 7, 8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    case 'cry':
      ctx.beginPath();
      ctx.arc(x, y + 9, 7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    case 'surprised':
      ctx.fillStyle = '#8c2f39';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 4.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'smile':
      ctx.beginPath();
      ctx.arc(x, y - 3, 9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    default: {
      // resting mouth style
      switch (d.mouthStyle) {
        case 0:
          ctx.beginPath();
          ctx.arc(x, y - 3, 9, Math.PI * 0.18, Math.PI * 0.82);
          ctx.stroke();
          break;
        case 1:
          ctx.beginPath();
          ctx.moveTo(x - 8, y + 1);
          ctx.lineTo(x + 8, y + 1);
          ctx.stroke();
          break;
        case 2:
          ctx.beginPath();
          ctx.arc(x, y + 6, 8, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
          break;
        default:
          ctx.fillStyle = '#8c2f39';
          ctx.beginPath();
          ctx.arc(x, y - 2, 7, Math.PI * 0.1, Math.PI * 0.9);
          ctx.closePath();
          ctx.fill();
      }
    }
  }
}

function drawGlasses(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(EYE_LX - 1, EYE_Y, 9.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(EYE_RX + 1, EYE_Y, 9.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(EYE_LX + 8, EYE_Y - 1);
  ctx.lineTo(EYE_RX - 8, EYE_Y - 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(EYE_LX - 10.5, EYE_Y - 1);
  ctx.lineTo(-HEAD_R + 2, EYE_Y - 4);
  ctx.moveTo(EYE_RX + 10.5, EYE_Y - 1);
  ctx.lineTo(HEAD_R - 2, EYE_Y - 4);
  ctx.stroke();
}

function drawTears(ctx: CanvasRenderingContext2D, t: number) {
  const drop = (x: number, phase: number) => {
    const p = ((t * 0.9 + phase) % 1);
    const y = EYE_Y + 6 + p * 34;
    ctx.fillStyle = 'rgba(103, 232, 249, 0.95)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drop(EYE_LX - 2, 0);
  drop(EYE_RX + 2, 0.5);
}

// ---------------- face FX (expression engine v2) ----------------

/**
 * Comic-book overlays drawn around the head. Everything is drawn with
 * symmetric shapes (no text glyphs) so the character flip never mirrors
 * anything into nonsense.
 */
function drawFaceFx(ctx: CanvasRenderingContext2D, fx: FaceFx[], t: number) {
  if (!fx || fx.length === 0) return;

  // 🔴 anger vein — pulsing cross on the temple
  if (fx.includes('angerVein')) {
    const pulse = 1 + Math.sin(t * 11) * 0.16;
    ctx.save();
    ctx.translate(HEAD_R + 6, HEAD_CY - 16);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (const [dx, dy, ex, ey] of [
      [-5, -5, 5, 5],
      [-5, 5, 5, -5],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 💨 steam puffs rising from the top of the head
  if (fx.includes('steam')) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.75 + i / 3) % 1;
      const x = (i - 1) * 16 + Math.sin(ph * 6 + i * 2) * 4;
      const y = HEAD_CY - HEAD_R - 6 - ph * 30;
      const r = 4 + ph * 7;
      ctx.fillStyle = `rgba(120, 113, 108, ${0.42 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 💦 sweat drop flicking off the temple
  if (fx.includes('sweat')) {
    const ph = (t * 1.15) % 1;
    const x = HEAD_R - 2 + ph * 26;
    const y = HEAD_CY - 20 - Math.sin(ph * Math.PI) * 16;
    ctx.fillStyle = `rgba(56, 189, 248, ${0.95 * (1 - ph * 0.55)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6, 5.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // ❗ shock lines radiating from the head
  if (fx.includes('shockLines')) {
    const flick = 0.65 + Math.abs(Math.sin(t * 9)) * 0.35;
    ctx.strokeStyle = `rgba(194, 65, 12, ${flick})`;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const angles = [-125, -95, -85, -55, -25];
    for (const aDeg of angles) {
      const a = aDeg * D;
      const r0 = HEAD_R + 7;
      const r1 = HEAD_R + 15 + (aDeg % 2 === 0 ? 4 : 0);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, HEAD_CY + Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, HEAD_CY + Math.sin(a) * r1);
      ctx.stroke();
    }
  }

  // 🎵 music notes floating up (drawn, not text — flip-safe)
  if (fx.includes('music')) {
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.6 + i * 0.5) % 1;
      const x = HEAD_R + 8 + i * 13;
      const y = HEAD_CY - 26 - ph * 34;
      const alpha = 0.85 * (1 - ph);
      ctx.fillStyle = `rgba(124, 45, 18, ${alpha})`;
      ctx.strokeStyle = `rgba(124, 45, 18, ${alpha})`;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      // note head + stem + flag
      ctx.beginPath();
      ctx.ellipse(x, y, 3.4, 2.6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 3, y - 1);
      ctx.lineTo(x + 3, y - 13);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 3, y - 13);
      ctx.quadraticCurveTo(x + 9, y - 11, x + 7, y - 5);
      ctx.stroke();
    }
  }

  // 😊 blush on the cheeks
  if (fx.includes('blush')) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.beginPath();
    ctx.ellipse(EYE_LX - 1, HEAD_CY + 8, 6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(EYE_RX + 1, HEAD_CY + 8, 6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 💤 sleep z's (drawn as line-based z so mirroring stays readable)
  if (fx.includes('zzz')) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 0.33) % 1;
      const s = 4 + i * 2.4;
      const x = HEAD_R + 8 + i * 9;
      const y = HEAD_CY - HEAD_R - 4 - ph * 22;
      const alpha = 0.8 * (1 - ph);
      ctx.strokeStyle = `rgba(100, 116, 139, ${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.stroke();
    }
  }
}

function drawHeadwear(ctx: CanvasRenderingContext2D, d: CharacterDesign) {
  const c = d.headwearColor;
  const dark = shade(c, -0.22);
  switch (d.headwearStyle) {
    case 1: // টুপি
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 6, HEAD_R + 1, Math.PI * 1.06, Math.PI * 1.94);
      ctx.closePath();
      ctx.fill();
      rr(ctx, -HEAD_R + 4, HEAD_CY - 20, HEAD_R * 2 - 8, 9, 4);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-HEAD_R + 5, HEAD_CY - 16);
      ctx.lineTo(HEAD_R - 5, HEAD_CY - 16);
      ctx.stroke();
      break;
    case 2: // ক্যাপ
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(HEAD_CX, HEAD_CY - 4, HEAD_R, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(HEAD_CX + 16, HEAD_CY - 14, 16, 4.5, 0.12, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, HEAD_CX, HEAD_CY - HEAD_R - 4, 3.2, dark);
      break;
    case 3: // পাগড়ি
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(HEAD_CX, HEAD_CY - 16, HEAD_R + 2, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(HEAD_CX, HEAD_CY - 28, HEAD_R - 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(HEAD_CX, HEAD_CY - 38, HEAD_R - 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-HEAD_R - 1, HEAD_CY - 18);
      ctx.quadraticCurveTo(0, HEAD_CY - 10, HEAD_R + 1, HEAD_CY - 18);
      ctx.stroke();
      break;
  }
}

function drawHead(ctx: CanvasRenderingContext2D, d: CharacterDesign, pose: Pose, t: number) {
  ctx.save();
  ctx.translate(0, -150);
  ctx.rotate((pose.headTilt + pose.headNod) * D);
  ctx.translate(-0, 150);

  // neck
  capsule(ctx, 0, -148, 0, HEAD_CY + HEAD_R - 6, 12, shade(d.skin, -0.12));

  // ears
  circle(ctx, -HEAD_R + 1, HEAD_CY + 4, 6, shade(d.skin, -0.08));
  circle(ctx, HEAD_R - 1, HEAD_CY + 4, 6, shade(d.skin, -0.08));

  drawHairBack(ctx, d);

  // head
  circle(ctx, HEAD_CX, HEAD_CY, HEAD_R, d.skin);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(HEAD_CX, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.stroke();

  // soft top-left highlight for volume
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(HEAD_CX - 10, HEAD_CY - 14, 12, 8, -0.5, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx, d);
  drawBeard(ctx, d);
  drawBrows(ctx, pose, d);
  drawEyes(ctx, d, pose);
  drawNose(ctx, d);
  drawMouth(ctx, d, pose);
  if (d.glasses) drawGlasses(ctx);
  if (pose.tears) drawTears(ctx, t);
  drawHeadwear(ctx, d);
  if (pose.fx && pose.fx.length > 0) drawFaceFx(ctx, pose.fx, t);

  ctx.restore();
}

// ---------------- main entry ----------------

/**
 * Draw a character. The ctx must already be translated to the character's
 * ground point, and pre-scaled (and flipped via scale(-1,1) if needed).
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  d: CharacterDesign,
  pose: Pose,
  t: number = 0,
  prop: PropName = 'none',
) {
  ctx.save();
  ctx.rotate(pose.bodyLean * D);

  // soft ground shadow (radial fade) — stays ON THE GROUND while the body
  // jumps (drawn before the y translate), shrinking & fading with height
  const airH = Math.max(0, pose.yOff); // height above ground (units)
  const airK = 1 / (1 + airH / 46);
  const sg = ctx.createRadialGradient(0, 2, 2, 0, 2, 38 * airK);
  sg.addColorStop(0, `rgba(0,0,0,${(0.24 * airK).toFixed(3)})`);
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(0, 2, 38 * airK, 9 * airK, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(pose.xOff, -pose.yOff);

  // squash & stretch about the ground point (cartoon physics)
  const sq = Math.max(-0.9, Math.min(0.9, pose.squash ?? 0));
  if (sq !== 0) ctx.scale(1 + sq * 0.16, 1 - sq * 0.14);

  // far arm behind torso
  const sleeveLong = d.topStyle === 1 || d.topStyle === 2 || d.topStyle === 3;
  const sleeveless = d.topStyle === 4;
  const upperArmColor = sleeveless ? d.skin : d.topColor;
  const foreArmColor = sleeveLong ? d.topColor : d.skin;

  drawLegSide(ctx, d, pose);
  drawBottom(ctx, d, pose);
  drawArm(ctx, SHOULDER_LX, SHOULDER_Y, pose.shoulderL, pose.elbowL, upperArmColor, foreArmColor);
  drawTorso(ctx, d);
  drawHead(ctx, d, pose, t);
  drawArm(
    ctx,
    SHOULDER_RX,
    SHOULDER_Y,
    pose.shoulderR,
    pose.elbowR,
    upperArmColor,
    foreArmColor,
    pose.fist ?? false,
  );

  // prop in the near hand (follows the hand via forward kinematics)
  if (prop && prop !== 'none') drawProp(ctx, prop, pose, t);

  ctx.restore();
}

function drawLegSide(ctx: CanvasRenderingContext2D, d: CharacterDesign, pose: Pose) {
  // For pant/pajama the drawBottom handles legs; here only ensure bare-leg
  // drawing happens for lungi/skirt (inside drawBottom). Nothing needed here
  // separately — kept for clarity/future layering.
  void ctx;
  void d;
  void pose;
}
