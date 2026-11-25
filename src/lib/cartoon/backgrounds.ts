// ============================================================
// ঠাট্টা স্টুডিও — Procedural backgrounds (cached offscreen render)
// Stage: 1280 x 720, characters stand on y = GROUND_Y (636)
// ============================================================

import { GROUND_Y, STAGE_H, STAGE_W, type BgName } from './types';
import { bgScale, densityCount } from '../render-quality';

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Sprint 8 — bump when background painting changes so stale cached canvases
 * (e.g. from a hot-reload session) are never reused.
 * Sprint 10 — foreground depth layer + scene-tinted shadow palette.
 */
const CACHE_VERSION = 'v10';

/**
 * Phase 8 — memory audit: each 2× canvas is ≈15 MB of GPU/heap, so the
 * 16 backgrounds × (bg + fg) could silently hold ≈450 MB. Simple LRU
 * (Map insertion order) caps both caches; re-paint is cheap (~few ms).
 */
const MAX_BG_CACHED = 10;
const MAX_FG_CACHED = 8;

function lruPut(store: Map<string, HTMLCanvasElement>, key: string, c: HTMLCanvasElement, max: number) {
  store.set(key, c);
  if (store.size > max) {
    const oldest = store.keys().next().value;
    if (oldest != null) store.delete(oldest);
  }
}

/**
 * Sprint 7 — backgrounds are painted once at a supersampled resolution
 * (2× on high-end, 1.25× in battery/low-end mode — Phase 8). The stage
 * then draws them downscaled, so they stay sharp on HiDPI screens and in
 * 1080p video exports.
 */
function baseCanvas(): HTMLCanvasElement {
  const ss = bgScale();
  const c = document.createElement('canvas');
  c.width = Math.round(STAGE_W * ss);
  c.height = Math.round(STAGE_H * ss);
  return c;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function skyGradient(
  ctx: CanvasRenderingContext2D,
  top: string,
  bottom: string,
  horizon: number,
) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, horizon);
}

function sun(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Sprint 8 — real radial glow: a wide warm halo + inner bloom + crisp disc
  // (replaces the flat halo circle — all 7 outdoor scenes inherit this)
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 110);
  glow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
  glow.addColorStop(0.45, 'rgba(251, 191, 36, 0.22)');
  glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 110, 0, Math.PI * 2);
  ctx.fill();
  const bloom = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, 46);
  bloom.addColorStop(0, '#fef3c7');
  bloom.addColorStop(0.7, '#fbbf24');
  bloom.addColorStop(1, '#f59e0b');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(x, y, 44, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
  ctx.arc(x + 30 * s, y - 12 * s, 30 * s, 0, Math.PI * 2);
  ctx.arc(x + 62 * s, y, 24 * s, 0, Math.PI * 2);
  ctx.fill();
}

function palm(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  trunk = '#8b5e34',
  leaf = '#15803d',
) {
  ctx.strokeStyle = trunk;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + 12, baseY - h * 0.6, x + 6, baseY - h);
  ctx.stroke();
  ctx.fillStyle = leaf;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    const lx = x + 6 + Math.cos(a) * 58;
    const ly = baseY - h + Math.sin(a) * 44;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 34, 9, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bush(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = '#22c55e') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 20 * s, y - 8 * s, 20 * s, 0, Math.PI * 2);
  ctx.arc(x + 40 * s, y, 15 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- Sprint 8 realism toolkit ----------------

/**
 * Baked atmospheric haze — distant layers wash into the sky colour so the
 * scene gains real depth (aerial perspective, like classic matte painting).
 */
function haze(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tint = '255,244,214',
  strength = 0.3,
) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(${tint},${strength})`);
  g.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** soft contact / ambient shadow — everything grounded casts one */
function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.16,
) {
  const g = ctx.createRadialGradient(x, y, rx * 0.15, x, y, rx);
  g.addColorStop(0, `rgba(30,20,10,${alpha})`);
  g.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** organic grass tufts — deterministic (no Math.random → identical exports) */
function grassTufts(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  n: number,
  s = 1,
  color = '#3f9142',
  seed = 1,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + Math.sin(i * 12.9898 * seed) * s * 46;
    const py = y + Math.cos(i * 78.233 * seed) * s * 6;
    const hgt = (6 + Math.abs(Math.sin(i * 3.7 * seed)) * 9) * s;
    const lean = (Math.sin(i * 1.3 * seed) > 0 ? 4 : -4) * s;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + lean * 0.4, py - hgt * 0.7, px + lean, py - hgt);
    ctx.stroke();
  }
}

/** warm light pool cast from above (lamps, chandeliers, windows) */
function lightPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  strength = 0.2,
) {
  const g = ctx.createRadialGradient(x, y, rx * 0.1, x, y, rx);
  g.addColorStop(0, `rgba(255,236,170,${strength})`);
  g.addColorStop(0.6, `rgba(255,236,170,${strength * 0.4})`);
  g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- village ----------------

function drawVillage(ctx: CanvasRenderingContext2D) {
  const horizon = 470;
  skyGradient(ctx, '#fffbeb', '#fde68a', horizon);

  sun(ctx, 1080, 130);
  cloud(ctx, 220, 120, 1);
  cloud(ctx, 700, 90, 0.8);
  cloud(ctx, 480, 170, 0.6);

  // distant field
  ctx.fillStyle = '#d9f99d';
  ctx.fillRect(0, horizon - 24, STAGE_W, 24);
  ctx.fillStyle = '#bef264';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(0, GROUND_Y - 14, STAGE_W, STAGE_H - GROUND_Y + 14);

  // Sprint 8 — aerial perspective: the far field melts into the warm sky
  haze(ctx, 0, horizon - 30, STAGE_W, 150, '255,247,214', 0.42);
  // grazing light across the meadow + scattered tufts and bush shadows
  grassTufts(ctx, 40, horizon + 58, 16, 0.85, '#65a30d', 3.1);
  grassTufts(ctx, 980, horizon + 44, 12, 0.8, '#65a30d', 7.2);
  grassTufts(ctx, 360, GROUND_Y - 6, 18, 1.05, '#4d7c0f', 5.4);
  grassTufts(ctx, 640, GROUND_Y - 4, 14, 1.0, '#4d7c0f', 9.7);

  // mud house
  const hx = 150;
  const hy = horizon + 40;
  ctx.fillStyle = '#d6a35c';
  rr(ctx, hx, hy, 240, 130, 6);
  ctx.fillStyle = '#9a6a3a';
  ctx.beginPath();
  ctx.moveTo(hx - 30, hy + 8);
  ctx.quadraticCurveTo(hx + 120, hy - 78, hx + 270, hy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7c5226';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(hx + 120, hy - 22 + i * 6, 150 - i * 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // door + window
  ctx.fillStyle = '#6b3f1d';
  rr(ctx, hx + 95, hy + 55, 50, 75, 4);
  ctx.fillStyle = '#fde68a';
  rr(ctx, hx + 22, hy + 30, 40, 34, 4);
  rr(ctx, hx + 178, hy + 30, 40, 34, 4);
  ctx.strokeStyle = '#7c5226';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + 42, hy + 30);
  ctx.lineTo(hx + 42, hy + 64);
  ctx.moveTo(hx + 198, hy + 30);
  ctx.lineTo(hx + 198, hy + 64);
  ctx.stroke();

  // banana tree right
  const bx = 1050;
  ctx.strokeStyle = '#65a30d';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(bx, horizon + 130);
  ctx.quadraticCurveTo(bx + 4, horizon + 40, bx, horizon - 20);
  ctx.stroke();
  ctx.fillStyle = '#4ade80';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55;
    ctx.beginPath();
    ctx.ellipse(bx + Math.cos(a) * 55, horizon - 20 + Math.sin(a) * 34, 46, 12, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  bush(ctx, 480, GROUND_Y - 8, 0.8, '#4ade80');
  bush(ctx, 880, GROUND_Y - 4, 0.6, '#4ade80');
  softShadow(ctx, 500, GROUND_Y - 2, 60, 10, 0.18);
  softShadow(ctx, 900, GROUND_Y + 2, 46, 8, 0.16);

  // hay stack
  softShadow(ctx, 760, GROUND_Y - 8, 52, 10, 0.2);
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(760, GROUND_Y - 16, 34, Math.PI, Math.PI * 2);
  ctx.fill();
  // thatch strokes + warm side shading (reads as a real haystack)
  ctx.strokeStyle = 'rgba(146,64,14,0.4)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 7);
    ctx.beginPath();
    ctx.moveTo(760 + Math.cos(a) * 8, GROUND_Y - 18 + Math.sin(a) * 8);
    ctx.lineTo(760 + Math.cos(a) * 33, GROUND_Y - 16 + Math.sin(a) * 22);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,236,170,0.25)';
  ctx.beginPath();
  ctx.ellipse(748, GROUND_Y - 34, 12, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- bazaar ----------------

function drawBazaar(ctx: CanvasRenderingContext2D) {
  const horizon = 450;
  skyGradient(ctx, '#fff7ed', '#fecaca', horizon);
  ctx.fillStyle = '#f5d0a9';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  ctx.fillStyle = '#eec49a';
  ctx.fillRect(0, GROUND_Y - 10, STAGE_W, STAGE_H - GROUND_Y + 10);

  // Sprint 8 — dusty market air: warm haze at the horizon + worn dirt patches
  haze(ctx, 0, horizon - 20, STAGE_W, 140, '255,238,214', 0.38);
  for (let i = 0; i < 9; i++) {
    const px = 90 + i * 137;
    const py = horizon + 120 + Math.abs(Math.sin(i * 5.1)) * 130;
    ctx.fillStyle = `rgba(146,94,52,${0.07 + (i % 3) * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(px % STAGE_W, Math.min(GROUND_Y + 40, py), 60, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // shop stalls
  const stall = (x: number, awn1: string, awn2: string, w: number) => {
    const y = horizon + 30;
    // Sprint 8 — grounded stall shadow before the stall itself
    softShadow(ctx, x + w * 0.45, y + 168, w * 0.62, 14, 0.2);
    ctx.fillStyle = '#e7c6a2';
    rr(ctx, x, y, w, 150, 4);
    ctx.fillStyle = '#a16207';
    ctx.fillRect(x, y, w, 10);
    // awning stripes
    for (let i = 0; i < Math.ceil(w / 34); i++) {
      ctx.fillStyle = i % 2 === 0 ? awn1 : awn2;
      ctx.beginPath();
      ctx.moveTo(x + i * 34, y);
      ctx.lineTo(x + (i + 1) * 34, y);
      ctx.lineTo(x + (i + 1) * 34, y + 34);
      ctx.quadraticCurveTo(x + (i + 0.5) * 34, y + 46, x + i * 34, y + 34);
      ctx.closePath();
      ctx.fill();
    }
    // goods
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(x + w * 0.3, y + 120, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x + w * 0.3 + 26, y + 124, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(x + w * 0.55, y + 122, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c3aed';
    rr(ctx, x + w * 0.68, y + 105, 30, 26, 3);
  };

  stall(-30, '#ea580c', '#fef3c7', 300);
  stall(330, '#0d9488', '#fef3c7', 300);
  stall(690, '#e11d48', '#fef3c7', 300);
  stall(1050, '#7c3aed', '#fef3c7', 260);

  // hanging signboard
  ctx.fillStyle = '#7c2d12';
  rr(ctx, 560, 130, 170, 60, 8);
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fef3c7';
  ctx.font = '700 34px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('বাজার', 645, 162);

  // clay pots on ground
  softShadow(ctx, 268, GROUND_Y - 2, 52, 9, 0.18);
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(250, GROUND_Y - 12, 20, 14, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(285, GROUND_Y - 8, 14, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // pot rims + sheen (hand-thrown clay look)
  ctx.strokeStyle = 'rgba(80,40,10,0.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(250, GROUND_Y - 12, 20, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(285, GROUND_Y - 8, 14, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,236,170,0.3)';
  ctx.beginPath();
  ctx.ellipse(243, GROUND_Y - 16, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- field ----------------

function drawField(ctx: CanvasRenderingContext2D) {
  const horizon = 440;
  skyGradient(ctx, '#fffbeb', '#fed7aa', horizon);
  sun(ctx, 180, 120);
  cloud(ctx, 800, 110, 0.9);

  // Sprint 9 — muted treeline hugging the horizon
  for (let i = 0; i < 14; i++) {
    bush(ctx, i * 96 + 20, horizon - 4 - (i % 3) * 5, 0.72 + (i % 3) * 0.16, i % 2 ? '#7d9b6a' : '#74916b');
  }
  ctx.fillStyle = 'rgba(125, 155, 106, 0.65)';
  ctx.fillRect(0, horizon - 8, STAGE_W, 10);

  // paddy field bands — rows grow taller and darker toward the foreground
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  const rows = ['#bef264', '#a3e635', '#84cc16', '#a3e635', '#84cc16'];
  for (let i = 0; i < 6; i++) {
    const y = horizon + i * ((GROUND_Y + 40 - horizon) / 6);
    ctx.fillStyle = rows[i % rows.length];
    ctx.fillRect(0, y, STAGE_W, 12 + i * 3);
  }
  // aerial perspective across the horizon band
  haze(ctx, 0, horizon - 10, STAGE_W, 90, '255, 244, 214', 0.35);

  // palms rise from the field edge (shadows drawn first)
  softShadow(ctx, 128, horizon + 62, 46, 11, 0.18);
  softShadow(ctx, 1188, horizon + 52, 50, 12, 0.18);
  softShadow(ctx, 1088, horizon + 72, 40, 10, 0.16);
  palm(ctx, 120, horizon + 60, 180);
  palm(ctx, 1180, horizon + 50, 200);
  palm(ctx, 1080, horizon + 70, 140);

  // rice tufts — far rows small and pale, grain tips gild some near stems
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = 30 + (i * 1230) / 40 + ((i * 7) % 30);
    const y = GROUND_Y - 40 - ((i * 13) % 120);
    const depth = (GROUND_Y - y) / 160;
    const s = 1.25 - depth * 0.6;
    ctx.strokeStyle = depth > 0.55 ? '#65a30d' : '#3f6212';
    ctx.lineWidth = depth > 0.55 ? 2.2 : 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 * s, y - 14 * s);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 * s, y - 12 * s);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16 * s);
    ctx.stroke();
    if (i % 3 === 0) circle(ctx, x + 0.5, y - 17 * s, 2.2 * s, '#eab308');
  }

  // scarecrow far left
  softShadow(ctx, 64, horizon + 92, 44, 9, 0.18);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(60, horizon + 90);
  ctx.lineTo(60, horizon + 20);
  ctx.moveTo(34, horizon + 45);
  ctx.lineTo(86, horizon + 45);
  ctx.stroke();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(60, horizon + 12, 14, 0, Math.PI * 2);
  ctx.fill();

  // egrets wading in the paddy
  const egret = (x: number, y: number, s: number, dir: number) => {
    softShadow(ctx, x, y, 18 * s, 4.5 * s, 0.15);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y);
    ctx.lineTo(x - 2 * s, y - 13 * s);
    ctx.moveTo(x + 3 * s, y);
    ctx.lineTo(x + 2 * s, y - 13 * s);
    ctx.stroke();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(x + 6 * s * dir, y - 16 * s);
    ctx.quadraticCurveTo(x + 12 * s * dir, y - 27 * s, x + 8 * s * dir, y - 33 * s);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * s, 10 * s, 6 * s, -0.12 * dir, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, x + 8 * s * dir, y - 34 * s, 3.4 * s, '#f8fafc');
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(x + 8 * s * dir, y - 35.5 * s);
    ctx.lineTo(x + 13.5 * s * dir, y - 34 * s);
    ctx.lineTo(x + 8 * s * dir, y - 33 * s);
    ctx.closePath();
    ctx.fill();
  };
  egret(540, GROUND_Y - 30, 1, 1);
  egret(770, GROUND_Y - 62, 0.78, -1);
  egret(960, GROUND_Y - 24, 0.9, 1);

  // foreground tuft clusters along the bottom edge
  grassTufts(ctx, 210, GROUND_Y + 46, 16, 1.1, '#3f6212', 4.3);
  grassTufts(ctx, 700, GROUND_Y + 52, 14, 1.05, '#3f6212', 6.9);
  grassTufts(ctx, 1060, GROUND_Y + 44, 15, 1.15, '#4d7c0f', 8.2);
}

// ---------------- room ----------------

function drawRoom(ctx: CanvasRenderingContext2D) {
  // wall
  const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  g.addColorStop(0, '#fef3c7');
  g.addColorStop(1, '#fde1b9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  // floor
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 520, STAGE_W, STAGE_H - 520);
  ctx.fillStyle = '#b45309';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect((i * 84) % STAGE_W, 520, 4, STAGE_H - 520);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const y = 520 + i * i * 12;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_W, y);
    ctx.stroke();
  }

  // window
  ctx.fillStyle = '#0d9488';
  rr(ctx, 120, 140, 220, 190, 8);
  ctx.fillStyle = '#ccfbf1';
  rr(ctx, 136, 156, 188, 158, 6);
  ctx.strokeStyle = '#0d9488';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(230, 156);
  ctx.lineTo(230, 314);
  ctx.moveTo(136, 235);
  ctx.lineTo(324, 235);
  ctx.stroke();
  // curtain
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(112, 132);
  ctx.quadraticCurveTo(150, 240, 118, 340);
  ctx.lineTo(146, 340);
  ctx.quadraticCurveTo(170, 240, 150, 132);
  ctx.closePath();
  ctx.fill();

  // door right
  ctx.fillStyle = '#92400e';
  rr(ctx, 950, 220, 160, 300, 6);
  ctx.fillStyle = '#a16207';
  rr(ctx, 966, 236, 128, 270, 4);
  circle(ctx, 1078, 380, 7, '#fde047');

  // wall clock
  circle(ctx, 560, 160, 42, '#fff7ed');
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(560, 160, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(560, 160);
  ctx.lineTo(560, 132);
  ctx.moveTo(560, 160);
  ctx.lineTo(578, 170);
  ctx.stroke();

  // hanging lamp
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(760, 0);
  ctx.lineTo(760, 90);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(730, 120);
  ctx.quadraticCurveTo(760, 60, 790, 120);
  ctx.closePath();
  ctx.fill();
  circle(ctx, 760, 130, 9, '#fde047');
  // Sprint 8 — the lamp actually lights the room: warm pool on the floor
  // plus a soft halo around the flame
  const halo = ctx.createRadialGradient(760, 130, 4, 760, 130, 90);
  halo.addColorStop(0, 'rgba(253,224,71,0.4)');
  halo.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(760, 130, 90, 0, Math.PI * 2);
  ctx.fill();
  lightPool(ctx, 760, 600, 190, 44, 0.26);

  // mat
  ctx.fillStyle = '#dc2626';
  rr(ctx, 420, 600, 380, 80, 10);
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 4;
  ctx.strokeRect(440, 612, 340, 56);
}

// ---------------- pond ----------------

function drawPond(ctx: CanvasRenderingContext2D) {
  const horizon = 430;
  skyGradient(ctx, '#fffbeb', '#fecdd3', horizon);
  sun(ctx, 1000, 120);
  cloud(ctx, 300, 110, 0.8);

  // trees behind
  bush(ctx, 80, horizon - 10, 1.4, '#16a34a');
  bush(ctx, 1150, horizon - 20, 1.2, '#15803d');
  palm(ctx, 220, horizon + 10, 150);
  palm(ctx, 1060, horizon + 16, 170);

  // far bank
  ctx.fillStyle = '#86efac';
  ctx.fillRect(0, horizon, STAGE_W, 60);
  // Sprint 8 — far bank recedes into the warm sky (aerial perspective)
  haze(ctx, 0, horizon - 14, STAGE_W, 110, '255,241,214', 0.4);

  // water
  const g = ctx.createLinearGradient(0, horizon, 0, 620);
  g.addColorStop(0, '#5eead4');
  g.addColorStop(1, '#0d9488');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon + 55, STAGE_W, 620 - horizon - 55);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = horizon + 90 + i * 22;
    const x = 120 + ((i * 260) % 950);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 6, x + 84, y);
    ctx.stroke();
  }

  // lotus
  const lotus = (x: number, y: number) => {
    ctx.fillStyle = '#fb7185';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 7, y, 7, 13, i * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    circle(ctx, x, y - 4, 4, '#fbbf24');
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(x + 18, y + 6, 16, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
  };
  lotus(430, horizon + 120);
  lotus(870, horizon + 165);

  // boat
  softShadow(ctx, 665, 578, 90, 10, 0.22);
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(560, 560);
  ctx.quadraticCurveTo(660, 600, 770, 560);
  ctx.quadraticCurveTo(660, 585, 560, 560);
  ctx.closePath();
  ctx.fill();
  // Sprint 8 — wobbly boat reflection + hull planks (water reads real)
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.ellipse(665, 596, 96, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.ellipse(665, 610, 110, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,26,10,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(600, 566);
  ctx.quadraticCurveTo(665, 584, 730, 566);
  ctx.stroke();

  // near bank (walking strip)
  ctx.fillStyle = '#d9f99d';
  ctx.fillRect(0, 620, STAGE_W, STAGE_H - 620);
  ctx.fillStyle = '#bef264';
  ctx.fillRect(0, GROUND_Y - 8, STAGE_W, STAGE_H - GROUND_Y + 8);
}

// ---------------- rajcourt (রাজসভা) ----------------

function drawRajcourt(ctx: CanvasRenderingContext2D) {
  // palace hall wall
  const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  g.addColorStop(0, '#fde8cd');
  g.addColorStop(1, '#f3cfa0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // marble floor
  ctx.fillStyle = '#e7d3b1';
  ctx.fillRect(0, 500, STAGE_W, STAGE_H - 500);
  ctx.fillStyle = 'rgba(180, 140, 90, 0.25)';
  for (let i = 1; i < 6; i++) {
    const y = 500 + i * i * 8;
    ctx.fillRect(0, y, STAGE_W, 3);
  }
  // inlaid diamond pattern
  ctx.strokeStyle = 'rgba(161, 98, 7, 0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = 80 + i * 160;
    ctx.beginPath();
    ctx.moveTo(x, 560);
    ctx.lineTo(x + 60, 600);
    ctx.lineTo(x, 640);
    ctx.lineTo(x - 60, 600);
    ctx.closePath();
    ctx.stroke();
  }

  // back arch wall
  ctx.fillStyle = '#d9a86c';
  ctx.fillRect(0, 120, STAGE_W, 380);
  ctx.fillStyle = '#c48b4e';
  for (let i = 0; i < 5; i++) {
    const x = 90 + i * 270;
    ctx.beginPath();
    ctx.moveTo(x, 470);
    ctx.lineTo(x, 210);
    ctx.quadraticCurveTo(x + 60, 150, x + 120, 210);
    ctx.lineTo(x + 120, 470);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5a26';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 244, 214, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x + 22, 450);
    ctx.lineTo(x + 22, 222);
    ctx.quadraticCurveTo(x + 60, 175, x + 98, 222);
    ctx.lineTo(x + 98, 450);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c48b4e';
  }

  // pillars
  const pillar = (x: number) => {
    ctx.fillStyle = '#b98a54';
    rr(ctx, x, 140, 46, 380, 8);
    ctx.fillStyle = '#a1743f';
    rr(ctx, x - 8, 128, 62, 26, 6);
    rr(ctx, x - 8, 508, 62, 24, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, x + 8, 150, 10, 356, 5);
  };
  pillar(40);
  pillar(1194);

  // throne platform
  ctx.fillStyle = '#9a3412';
  rr(ctx, 480, 300, 320, 200, 10);
  ctx.fillStyle = '#b45309';
  rr(ctx, 500, 320, 280, 180, 8);
  // throne back
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(540, 320);
  ctx.quadraticCurveTo(640, 180, 740, 320);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.stroke();
  // cushion
  ctx.fillStyle = '#dc2626';
  rr(ctx, 560, 300, 160, 40, 12);
  circle(ctx, 640, 292, 16, '#fbbf24');

  // red carpet
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(560, 500);
  ctx.lineTo(720, 500);
  ctx.lineTo(800, STAGE_H);
  ctx.lineTo(480, STAGE_H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(566, 505);
  ctx.lineTo(490, STAGE_H);
  ctx.moveTo(714, 505);
  ctx.lineTo(790, STAGE_H);
  ctx.stroke();

  // chandelier
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(640, 0);
  ctx.lineTo(640, 60);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(640, 84, 90, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(640, 76, 60, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 640, 60, 8, '#fde047');
  // Sprint 8 — candle glow + a grand light pool across the marble floor
  const cg = ctx.createRadialGradient(640, 78, 10, 640, 78, 160);
  cg.addColorStop(0, 'rgba(253,224,71,0.45)');
  cg.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(640, 78, 160, 0, Math.PI * 2);
  ctx.fill();
  lightPool(ctx, 640, 620, 300, 60, 0.18);
}

// ---------------- school (স্কুল) ----------------

function drawSchool(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  g.addColorStop(0, '#fef9ec');
  g.addColorStop(1, '#f8e3bd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // floor
  ctx.fillStyle = '#c98d4b';
  ctx.fillRect(0, 540, STAGE_W, STAGE_H - 540);
  ctx.strokeStyle = 'rgba(120, 70, 20, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 5; i++) {
    const y = 540 + i * i * 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_W, y);
    ctx.stroke();
  }

  // wainscot
  ctx.fillStyle = '#a16207';
  ctx.fillRect(0, 420, STAGE_W, 120);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(STAGE_W, 420);
  ctx.stroke();

  // blackboard
  ctx.fillStyle = '#7c4a21';
  rr(ctx, 360, 130, 560, 270, 12);
  ctx.fillStyle = '#2f5d50';
  rr(ctx, 382, 152, 516, 226, 8);
  // chalk writing
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.font = '700 44px "Hind Siliguri", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'center';
  ctx.fillText('আ আ কা খ', 640, 240);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(430, 290);
  ctx.quadraticCurveTo(520, 270, 610, 288);
  ctx.moveTo(660, 290);
  ctx.quadraticCurveTo(740, 272, 830, 286);
  ctx.stroke();
  // chalk ledge
  ctx.fillStyle = '#a16207';
  rr(ctx, 380, 396, 520, 16, 4);
  circle(ctx, 820, 392, 6, '#f8fafc');

  // windows
  const win = (x: number) => {
    ctx.fillStyle = '#0d9488';
    rr(ctx, x, 150, 200, 180, 10);
    ctx.fillStyle = '#bae6fd';
    rr(ctx, x + 14, 164, 172, 152, 6);
    // sky + hill through window
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(x + 14, 164, 172, 90);
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.arc(x + 100, 262, 70, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x + 100, 164);
    ctx.lineTo(x + 100, 316);
    ctx.moveTo(x + 14, 240);
    ctx.lineTo(x + 186, 240);
    ctx.stroke();
  };
  win(60);
  win(1020);

  // Sprint 8 — sunshine through the windows paints warm pools on the floor
  lightPool(ctx, 160, 620, 170, 42, 0.22);
  lightPool(ctx, 1120, 620, 170, 42, 0.22);

  // door
  ctx.fillStyle = '#92400e';
  rr(ctx, 580, 440, 130, 190, 8);
  ctx.fillStyle = '#b45309';
  rr(ctx, 594, 454, 102, 162, 6);
  circle(ctx, 682, 540, 6, '#fde047');

  // benches (side, behind action area)
  const bench = (x: number) => {
    ctx.fillStyle = '#b45309';
    rr(ctx, x, 470, 150, 18, 5);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 12, 488, 12, 52);
    ctx.fillRect(x + 126, 488, 12, 52);
  };
  bench(150);
  bench(990);
}

// ---------------- ghat (ঘাট) ----------------

function drawGhat(ctx: CanvasRenderingContext2D) {
  const horizon = 400;
  // golden-hour sky
  skyGradient(ctx, '#fef3c7', '#fdba74', horizon);
  sun(ctx, 220, 150);
  cloud(ctx, 760, 100, 0.9);

  // temple silhouettes
  ctx.fillStyle = '#9a6a3a';
  const shikhara = (x: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x, horizon - h * 0.55);
    ctx.quadraticCurveTo(x + w / 2, horizon - h * 1.25, x + w, horizon - h * 0.55);
    ctx.lineTo(x + w, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x + w / 2, horizon - h * 0.82, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a6a3a';
  };
  shikhara(880, 130, 200);
  shikhara(1050, 90, 150);
  shikhara(60, 110, 170);

  // river
  const g = ctx.createLinearGradient(0, horizon, 0, 560);
  g.addColorStop(0, '#fbbf24');
  g.addColorStop(0.4, '#38bdf8');
  g.addColorStop(1, '#0369a1');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, STAGE_W, 560 - horizon);

  // far ghat steps
  ctx.fillStyle = '#e7d3b1';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(0, horizon + 20 + i * 22, STAGE_W, 20);
    ctx.fillStyle = `rgba(120, 80, 40, ${0.08 + i * 0.05})`;
    ctx.fillRect(0, horizon + 20 + i * 22, STAGE_W, 4);
    // Sprint 9 — ambient occlusion pooling under each step lip
    const ao = ctx.createLinearGradient(0, horizon + 26 + i * 22, 0, horizon + 40 + i * 22);
    ao.addColorStop(0, 'rgba(90, 60, 30, 0.1)');
    ao.addColorStop(1, 'rgba(90, 60, 30, 0)');
    ctx.fillStyle = ao;
    ctx.fillRect(0, horizon + 26 + i * 22, STAGE_W, 14);
    ctx.fillStyle = '#e7d3b1';
  }

  // Sprint 9 — golden haze over the far water line
  haze(ctx, 0, horizon - 12, STAGE_W, 110, '255, 238, 214', 0.3);

  // umbrella by the steps
  softShadow(ctx, 302, horizon + 112, 46, 9, 0.18);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(300, horizon + 62, 34, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(266, horizon + 62);
  ctx.lineTo(334, horizon + 62);
  ctx.stroke();
  ctx.strokeStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(300, horizon + 62);
  ctx.lineTo(300, horizon + 110);
  ctx.stroke();
  // red canopy reflection wobbling in the water below
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(286, 512);
  ctx.quadraticCurveTo(300, 530, 292, 548);
  ctx.quadraticCurveTo(306, 556, 312, 542);
  ctx.quadraticCurveTo(320, 524, 310, 512);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // boat
  softShadow(ctx, 830, 500, 128, 11, 0.16);
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(700, 470);
  ctx.quadraticCurveTo(830, 520, 960, 470);
  ctx.quadraticCurveTo(830, 500, 700, 470);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Sprint 9 — dark hull reflection blurring into the current
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#431407';
  ctx.beginPath();
  ctx.ellipse(830, 520, 110, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.ellipse(830, 534, 88, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // near bank strip (walkable)
  ctx.fillStyle = '#e7d3b1';
  ctx.fillRect(0, 560, STAGE_W, STAGE_H - 560);
  ctx.fillStyle = '#d9c193';
  ctx.fillRect(0, GROUND_Y - 6, STAGE_W, STAGE_H - GROUND_Y + 6);
  // steps edge
  ctx.fillStyle = '#c9a86e';
  ctx.fillRect(0, 552, STAGE_W, 10);
  // Sprint 9 — dark wet band where the steps meet the water
  const wet = ctx.createLinearGradient(0, 540, 0, 566);
  wet.addColorStop(0, 'rgba(40, 26, 12, 0)');
  wet.addColorStop(1, 'rgba(40, 26, 12, 0.3)');
  ctx.fillStyle = wet;
  ctx.fillRect(0, 540, STAGE_W, 26);
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 556);
  ctx.lineTo(STAGE_W, 556);
  ctx.stroke();
}

// ---------------- night (রাতের গ্রাম) ----------------

function drawNight(ctx: CanvasRenderingContext2D) {
  // deep indigo night sky (allowed: scene art, not UI chrome)
  const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  g.addColorStop(0, '#1e1b4b');
  g.addColorStop(0.6, '#312e81');
  g.addColorStop(1, '#4c1d95');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // static stars (twinkle added in ambient layer)
  ctx.fillStyle = '#fef9c3';
  for (let i = 0; i < 70; i++) {
    const x = (i * 331) % STAGE_W;
    const y = (i * 197) % 400;
    circle(ctx, x, y, (i % 3) * 0.6 + 0.8, '#fef9c3');
  }

  // Sprint 9 — moon with a real wide halo + bright bloom disc
  const halo = ctx.createRadialGradient(1050, 120, 34, 1050, 120, 160);
  halo.addColorStop(0, 'rgba(240, 240, 255, 0.35)');
  halo.addColorStop(0.5, 'rgba(226, 232, 255, 0.15)');
  halo.addColorStop(1, 'rgba(240, 240, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(1050, 120, 160, 0, Math.PI * 2);
  ctx.fill();
  const bloom = ctx.createRadialGradient(1044, 114, 8, 1050, 120, 54);
  bloom.addColorStop(0, '#fefce8');
  bloom.addColorStop(0.72, '#fef08a');
  bloom.addColorStop(1, '#fde047');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(1050, 120, 52, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 1032, 108, 10, 'rgba(202, 138, 4, 0.35)');
  circle(ctx, 1064, 132, 7, 'rgba(202, 138, 4, 0.3)');
  circle(ctx, 1058, 96, 5, 'rgba(202, 138, 4, 0.3)');

  // distant trees
  ctx.fillStyle = '#1e293b';
  bush(ctx, 160, 430, 2.4, '#1e293b');
  bush(ctx, 1000, 440, 2.0, '#1e293b');

  // ground
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 470, STAGE_W, STAGE_H - 470);
  ctx.fillStyle = '#3730a3';
  ctx.fillRect(0, GROUND_Y - 12, STAGE_W, STAGE_H - GROUND_Y + 12);

  // hut with lit window — long shadow stretched away from the moon
  const hx = 120;
  const hy = 470;
  ctx.fillStyle = 'rgba(8, 8, 26, 0.35)';
  ctx.beginPath();
  ctx.ellipse(hx + 52, hy + 174, 210, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#44403c';
  rr(ctx, hx, hy + 20, 250, 140, 6);
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.moveTo(hx - 34, hy + 28);
  ctx.quadraticCurveTo(hx + 125, hy - 70, hx + 284, hy + 28);
  ctx.closePath();
  ctx.fill();
  // Sprint 9 — moon rim-light on the moon-facing (right) edges
  ctx.strokeStyle = 'rgba(226, 232, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + 250, hy + 24);
  ctx.lineTo(hx + 250, hy + 158);
  ctx.moveTo(hx + 125, hy - 21);
  ctx.quadraticCurveTo(hx + 204, hy - 21, hx + 284, hy + 28);
  ctx.stroke();
  // warm glowing window
  ctx.fillStyle = '#fde047';
  rr(ctx, hx + 50, hy + 60, 52, 46, 4);
  const wg = ctx.createRadialGradient(hx + 76, hy + 83, 10, hx + 76, hy + 83, 110);
  wg.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
  wg.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = wg;
  ctx.fillRect(hx - 40, hy - 30, 240, 240);
  // window light spilling onto the ground
  lightPool(ctx, hx + 76, 642, 120, 26, 0.24);
  // door
  ctx.fillStyle = '#1c1917';
  rr(ctx, hx + 160, hy + 70, 60, 90, 4);
  // chimney smoke base
  ctx.fillStyle = '#44403c';
  rr(ctx, hx + 200, hy - 30, 26, 46, 3);

  // second hut far right — shadow away from the moon, rim on the lit edge
  ctx.fillStyle = 'rgba(8, 8, 26, 0.32)';
  ctx.beginPath();
  ctx.ellipse(972, 642, 180, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f3f46';
  rr(ctx, 950, 520, 190, 108, 6);
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(926, 526);
  ctx.quadraticCurveTo(1045, 452, 1164, 526);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(226, 232, 255, 0.4)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(1140, 524);
  ctx.lineTo(1140, 626);
  ctx.moveTo(1045, 489);
  ctx.quadraticCurveTo(1104, 489, 1164, 526);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  rr(ctx, 1000, 550, 40, 36, 3);
  lightPool(ctx, 1020, 646, 100, 22, 0.2);

  // Sprint 9 — cool moonlight pooling on the ground under the moon
  const mp = ctx.createRadialGradient(1030, 630, 30, 1030, 630, 260);
  mp.addColorStop(0, 'rgba(235, 240, 255, 0.17)');
  mp.addColorStop(1, 'rgba(235, 240, 255, 0)');
  ctx.fillStyle = mp;
  ctx.beginPath();
  ctx.ellipse(1030, 630, 260, 72, 0, 0, Math.PI * 2);
  ctx.fill();

  // pond reflection
  ctx.fillStyle = 'rgba(129, 140, 248, 0.18)';
  ctx.beginPath();
  ctx.ellipse(640, 660, 200, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // moon glint wobbling in the pond
  ctx.strokeStyle = 'rgba(235, 240, 255, 0.28)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const py = 646 + i * 9;
    ctx.beginPath();
    ctx.moveTo(600 + i * 14, py);
    ctx.quadraticCurveTo(640 + i * 10, py + 4, 690 - i * 12, py);
    ctx.stroke();
  }
}

// ---------------- temple (কালীবাড়ির উঠান) — Sprint 4 ----------------

function drawTemple(ctx: CanvasRenderingContext2D) {
  const horizon = 480;
  skyGradient(ctx, '#fefce8', '#fcd34d', horizon);
  sun(ctx, 170, 120);
  cloud(ctx, 820, 100, 0.75);

  // courtyard ground — packed earth
  ctx.fillStyle = '#e7c58f';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  ctx.fillStyle = '#d9b06e';
  ctx.fillRect(0, GROUND_Y - 10, STAGE_W, STAGE_H - GROUND_Y + 10);
  // flagstone lines
  ctx.strokeStyle = 'rgba(146, 106, 54, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = horizon + 30 + i * 38;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_W, y - 6);
    ctx.stroke();
  }

  // Sprint 9 — red-ochre wash where offerings dust the earth near the altar
  const rw = ctx.createRadialGradient(330, 530, 20, 330, 530, 200);
  rw.addColorStop(0, 'rgba(185, 45, 25, 0.14)');
  rw.addColorStop(1, 'rgba(185, 45, 25, 0)');
  ctx.fillStyle = rw;
  ctx.beginPath();
  ctx.ellipse(330, 530, 200, 85, 0, 0, Math.PI * 2);
  ctx.fill();

  // temple sanctum (far center-left): stepped plinth + curved bangla roof
  const tx = 210;
  const ty = horizon - 10;
  // plinth steps
  softShadow(ctx, tx + 120, ty + 50, 190, 17, 0.2);
  ctx.fillStyle = '#c8b18c';
  rr(ctx, tx - 30, ty + 24, 300, 22, 3);
  ctx.fillStyle = '#bda67f';
  rr(ctx, tx - 14, ty + 4, 268, 22, 3);
  // walls
  ctx.fillStyle = '#e2c390';
  rr(ctx, tx, ty - 96, 240, 102, 4);
  ctx.strokeStyle = '#926a36';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(tx, ty - 96, 240, 102);
  // char-chala curved roof
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(tx - 26, ty - 96);
  ctx.quadraticCurveTo(tx + 30, ty - 156, tx + 120, ty - 160);
  ctx.quadraticCurveTo(tx + 210, ty - 156, tx + 266, ty - 96);
  ctx.quadraticCurveTo(tx + 120, ty - 132, tx - 26, ty - 96);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 3;
  ctx.stroke();
  // kalash finial
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(tx + 120, ty - 170, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(tx + 117, ty - 186, 6, 12);
  // arched door with garland
  ctx.fillStyle = '#3b2412';
  ctx.beginPath();
  ctx.moveTo(tx + 92, ty + 2);
  ctx.lineTo(tx + 92, ty - 52);
  ctx.quadraticCurveTo(tx + 120, ty - 78, tx + 148, ty - 52);
  ctx.lineTo(tx + 148, ty + 2);
  ctx.closePath();
  ctx.fill();
  // marigold garland over the door
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(tx + 88, ty - 58);
  ctx.quadraticCurveTo(tx + 120, ty - 38, tx + 152, ty - 58);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  for (let i = 0; i < 6; i++) {
    const gx = 92 + i * 12;
    ctx.beginPath();
    ctx.arc(tx + gx, ty - 52 + Math.sin((i / 5) * Math.PI) * 12, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprint 9 — warm haze breathing out of the sanctum doorway
  haze(ctx, tx + 56, ty - 84, 128, 96, '255, 200, 140', 0.2);
  // hanging bell off the roof edge
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(tx + 232, ty - 104);
  ctx.lineTo(tx + 232, ty - 74);
  ctx.stroke();
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.moveTo(tx + 222, ty - 74);
  ctx.quadraticCurveTo(tx + 232, ty - 86, tx + 242, ty - 74);
  ctx.lineTo(tx + 238, ty - 52);
  ctx.quadraticCurveTo(tx + 232, ty - 46, tx + 226, ty - 52);
  ctx.closePath();
  ctx.fill();
  circle(ctx, tx + 232, ty - 44, 2.8, '#78350f');
  softShadow(ctx, tx + 238, ty - 32, 15, 7, 0.13);

  // prayer flags right side
  softShadow(ctx, 996, horizon + 4, 30, 7, 0.14);
  softShadow(ctx, 1156, horizon + 4, 30, 7, 0.14);
  ctx.fillStyle = '#7c3aed';
  rr(ctx, 990, horizon - 190, 8, 190, 2);
  ctx.fillStyle = '#dc2626';
  rr(ctx, 1150, horizon - 160, 8, 160, 2);
  const colors = ['#dc2626', '#f59e0b', '#16a34a', '#7c3aed', '#0891b2'];
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(994, horizon - 188);
  ctx.quadraticCurveTo(1072, horizon - 172, 1154, horizon - 158);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const p = (i + 0.5) / 5;
    const fx = 994 + p * 160;
    const fy = horizon - 188 + p * 28 + Math.sin(p * Math.PI) * 6;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(fx - 11, fy);
    ctx.lineTo(fx + 11, fy);
    ctx.lineTo(fx + 8, fy + 22);
    ctx.lineTo(fx - 8, fy + 22);
    ctx.closePath();
    ctx.fill();
  }

  // big banyan-ish tree left edge
  softShadow(ctx, 66, horizon + 152, 88, 17, 0.18);
  ctx.strokeStyle = '#6d4c2f';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(60, horizon + 150);
  ctx.quadraticCurveTo(40, horizon + 40, 70, horizon - 60);
  ctx.stroke();
  ctx.fillStyle = '#166534';
  bush(ctx, 10, horizon - 70, 2.6, '#166534');
  bush(ctx, 90, horizon - 40, 2.1, '#15803d');

  // diya lamps (oil lamps) near the steps
  const diya = (x: number, y: number) => {
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(x, y, 9, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 3, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y - 10, 16, 0, Math.PI * 2);
    ctx.fill();
  };
  lightPool(ctx, 160, GROUND_Y + 12, 40, 11, 0.28);
  lightPool(ctx, 1120, GROUND_Y + 10, 40, 11, 0.28);
  lightPool(ctx, 620, GROUND_Y + 16, 40, 11, 0.28);
  diya(160, GROUND_Y + 6);
  diya(1120, GROUND_Y + 4);
  diya(620, GROUND_Y + 10);
}

// ---------------- river (নদীপথ — নৌকা) — Sprint 4 ----------------

function drawRiver(ctx: CanvasRenderingContext2D) {
  const horizon = 430;
  skyGradient(ctx, '#f0fdfa', '#bae6fd', horizon);
  sun(ctx, 1010, 110);
  cloud(ctx, 260, 110, 0.85);
  cloud(ctx, 660, 80, 0.6);

  // far bank — trees strip
  ctx.fillStyle = '#4d7c0f';
  for (let i = 0; i < 12; i++) {
    const bx = i * 115 + 30;
    const by = horizon - 6 + (i % 3) * 8;
    ctx.beginPath();
    ctx.ellipse(bx, by - 26, 52, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#365314';
  ctx.fillRect(0, horizon - 10, STAGE_W, 14);
  // Sprint 9 — muted palms rising from the far bank
  softShadow(ctx, 478, horizon - 4, 34, 7, 0.14);
  softShadow(ctx, 822, horizon - 6, 30, 6, 0.14);
  palm(ctx, 470, horizon + 2, 150, '#75614a', '#5f7a52');
  palm(ctx, 815, horizon, 128, '#75614a', '#5f7a52');

  // river water
  const wg = ctx.createLinearGradient(0, horizon, 0, STAGE_H);
  wg.addColorStop(0, '#0ea5e9');
  wg.addColorStop(1, '#0369a1');
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);

  // Sprint 9 — far-bank haze melting into the sky + current streaks
  haze(ctx, 0, horizon - 30, STAGE_W, 80, '235, 246, 252', 0.3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const sy = 486 + i * 44 + (i % 2) * 8;
    ctx.beginPath();
    ctx.moveTo(70 + i * 120, sy);
    ctx.bezierCurveTo(330 + i * 80, sy - 16, 600 + i * 50, sy + 18, 960 + i * 40, sy - 6);
    ctx.stroke();
  }

  // boat near right (wooden kosha boat)
  const bxf = 940;
  const byf = 560;
  softShadow(ctx, bxf, byf + 14, 122, 13, 0.18);
  ctx.save();
  ctx.translate(bxf, byf);
  ctx.rotate(-0.045);
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.moveTo(-110, 0);
  ctx.quadraticCurveTo(0, 46, 110, 0);
  ctx.quadraticCurveTo(0, 22, -110, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5b3010';
  ctx.lineWidth = 3;
  ctx.stroke();
  // hull plank lines + short mast
  ctx.strokeStyle = 'rgba(60, 30, 8, 0.4)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-88, 5);
  ctx.quadraticCurveTo(0, 26, 88, 5);
  ctx.moveTo(-70, 9);
  ctx.quadraticCurveTo(0, 30, 70, 9);
  ctx.stroke();
  ctx.strokeStyle = '#5b3010';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(14, -62);
  ctx.stroke();
  // boat rim
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-110, 0);
  ctx.quadraticCurveTo(0, 26, 110, 0);
  ctx.stroke();
  // boatman oar
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.lineTo(-72, -34);
  ctx.stroke();
  ctx.restore();
  // boat reflection
  ctx.fillStyle = 'rgba(7, 40, 66, 0.28)';
  ctx.beginPath();
  ctx.ellipse(bxf, byf + 22, 96, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sprint 9 — wobbly mirrored hull streak + mast reflection
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#5b3010';
  ctx.beginPath();
  ctx.moveTo(bxf - 106, byf + 18);
  ctx.quadraticCurveTo(bxf - 30, byf + 38, bxf + 46, byf + 30);
  ctx.quadraticCurveTo(bxf + 84, byf + 24, bxf + 106, byf + 16);
  ctx.quadraticCurveTo(bxf, byf + 52, bxf - 106, byf + 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(210, 232, 248, 0.35)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const wy = byf + 26 + i * 9;
    const wx = bxf - 78 + ((i * 53) % 46);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 32, wy + 3.5, wx + 66, wy - 1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(60, 30, 8, 0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bxf + 10, byf + 20);
  ctx.quadraticCurveTo(bxf + 4, byf + 44, bxf + 12, byf + 66);
  ctx.stroke();
  ctx.restore();

  // near bank (foreground bottom) — mud ghat edge with grass
  ctx.fillStyle = '#c9a25e';
  ctx.beginPath();
  ctx.moveTo(0, STAGE_H);
  ctx.lineTo(0, GROUND_Y + 26);
  ctx.quadraticCurveTo(STAGE_W / 2, GROUND_Y - 8, STAGE_W, GROUND_Y + 40);
  ctx.lineTo(STAGE_W, STAGE_H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4d7c0f';
  for (let i = 0; i < 14; i++) {
    const gx = 40 + i * 92 + (i % 3) * 20;
    ctx.beginPath();
    ctx.ellipse(gx, GROUND_Y + 34 + (i % 4) * 9, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // bamboo posts at the bank edge
  for (const px of [180, 1060]) {
    softShadow(ctx, px + 4, GROUND_Y + 24, 26, 6, 0.16);
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(px, GROUND_Y + 22);
    ctx.lineTo(px + 6, GROUND_Y - 66);
    ctx.stroke();
    ctx.strokeStyle = '#7c4a03';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px - 3, GROUND_Y - 20);
    ctx.lineTo(px + 9, GROUND_Y - 24);
    ctx.moveTo(px - 1, GROUND_Y - 44);
    ctx.lineTo(px + 11, GROUND_Y - 48);
    ctx.stroke();
  }
}

// ---------------- kitchen (রান্নাঘর) — Sprint 4 ----------------

function drawKitchen(ctx: CanvasRenderingContext2D) {
  // warm mud-plastered interior
  const wg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  wg.addColorStop(0, '#a3542e');
  wg.addColorStop(0.55, '#b96b3d');
  wg.addColorStop(1, '#8f4a28');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  // floor
  ctx.fillStyle = '#7c3f20';
  ctx.fillRect(0, 520, STAGE_W, STAGE_H - 520);
  ctx.fillStyle = '#6b3419';
  ctx.fillRect(0, GROUND_Y, STAGE_W, STAGE_H - GROUND_Y);
  // floor mats
  ctx.fillStyle = '#a16207';
  rr(ctx, 420, 600, 440, 40, 6);
  ctx.strokeStyle = 'rgba(68, 38, 12, 0.55)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(430 + i * 88, 602);
    ctx.lineTo(430 + i * 88, 638);
    ctx.stroke();
  }

  // back wall — window with evening light
  ctx.fillStyle = '#5b2f16';
  rr(ctx, 760, 120, 190, 150, 8);
  ctx.fillStyle = '#fcd34d';
  rr(ctx, 772, 132, 166, 126, 5);
  // light beam
  const lg = ctx.createLinearGradient(855, 260, 855, 640);
  lg.addColorStop(0, 'rgba(253, 224, 71, 0.34)');
  lg.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(772, 258);
  ctx.lineTo(938, 258);
  ctx.lineTo(1010, 640);
  ctx.lineTo(700, 640);
  ctx.closePath();
  ctx.fill();

  // shelf with clay pots (left wall)
  ctx.fillStyle = '#5b2f16';
  rr(ctx, 90, 250, 300, 16, 3);
  // Sprint 9 — lit top face + dark underside edge
  ctx.fillStyle = 'rgba(255, 226, 180, 0.3)';
  ctx.fillRect(92, 250, 296, 4);
  ctx.fillStyle = 'rgba(40, 20, 8, 0.4)';
  ctx.fillRect(92, 262, 296, 4);
  // wall shadows behind the hanging utensils
  for (const hx of [180, 240, 300, 360, 420]) {
    const hang = 70 + ((hx * 13) % 40);
    softShadow(ctx, hx + 12, hang + 20, 20, 26, 0.13);
  }
  // contact shadows under the shelf pots
  softShadow(ctx, 140, 249, 24, 5, 0.18);
  softShadow(ctx, 200, 249, 20, 4, 0.16);
  softShadow(ctx, 258, 249, 26, 5, 0.18);
  softShadow(ctx, 320, 249, 18, 4, 0.15);
  const pot = (x: number, y: number, s: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 9 * s, y - 26 * s, 18 * s, 12 * s);
  };
  pot(140, 232, 1, '#c2691a');
  pot(200, 232, 0.8, '#d1791f');
  pot(258, 232, 1.1, '#b05615');
  pot(320, 232, 0.7, '#c2691a');
  // hanging utensils from the ceiling
  ctx.strokeStyle = '#3f2412';
  ctx.lineWidth = 3;
  for (const hx of [180, 240, 300, 360, 420]) {
    const hang = 70 + ((hx * 13) % 40);
    ctx.beginPath();
    ctx.moveTo(hx, 0);
    ctx.lineTo(hx, hang);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(hx, hang + 16, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(hx, hang + 16, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprint 9 — firelight washing the wall behind the chula + soot stain above
  const fg = ctx.createRadialGradient(1075, 470, 24, 1075, 470, 200);
  fg.addColorStop(0, 'rgba(251, 146, 60, 0.26)');
  fg.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = fg;
  ctx.fillRect(870, 290, 410, 350);
  const soot = ctx.createLinearGradient(0, 190, 0, 470);
  soot.addColorStop(0, 'rgba(18, 10, 6, 0)');
  soot.addColorStop(1, 'rgba(18, 10, 6, 0.12)');
  ctx.fillStyle = soot;
  ctx.fillRect(930, 190, 290, 280);
  // chula (clay stove) with smoke — right side
  softShadow(ctx, 1090, 624, 122, 20, 0.22);
  lightPool(ctx, 1085, 626, 150, 30, 0.3);
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.ellipse(1090, 560, 95, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6d3410';
  rr(ctx, 1020, 470, 145, 60, 10);
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(1075, 486, 22, 0, Math.PI * 2);
  ctx.fill();
  // fire glow
  ctx.fillStyle = 'rgba(234, 88, 12, 0.9)';
  ctx.beginPath();
  ctx.ellipse(1075, 486, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.beginPath();
  ctx.ellipse(1075, 489, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(234, 88, 12, 0.16)';
  ctx.beginPath();
  ctx.arc(1075, 480, 46, 0, Math.PI * 2);
  ctx.fill();
  // pot on the stove
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.ellipse(1075, 452, 34, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#52525b';
  ctx.beginPath();
  ctx.ellipse(1075, 440, 28, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // steam puffs (static base — dynamic in ambient)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(1075, 408, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sprint 9 — low wooden stool by the mat
  softShadow(ctx, 520, 620, 42, 9, 0.18);
  ctx.fillStyle = '#8b4513';
  rr(ctx, 494, 590, 54, 12, 4);
  ctx.fillStyle = '#6d3410';
  ctx.fillRect(500, 602, 9, 16);
  ctx.fillRect(533, 602, 9, 16);
  // water pots cooling by the wall
  softShadow(ctx, 352, 614, 30, 7, 0.18);
  softShadow(ctx, 392, 618, 24, 6, 0.16);
  ctx.fillStyle = '#b05615';
  ctx.beginPath();
  ctx.ellipse(350, 596, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(343, 570, 14, 12);
  ctx.fillStyle = '#c2691a';
  ctx.beginPath();
  ctx.ellipse(388, 602, 12, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(382, 582, 12, 10);
  // sack of rice (left foreground)
  softShadow(ctx, 215, GROUND_Y + 10, 92, 14, 0.2);
  ctx.fillStyle = '#d6b25e';
  ctx.beginPath();
  ctx.moveTo(150, GROUND_Y + 8);
  ctx.quadraticCurveTo(140, GROUND_Y - 80, 215, GROUND_Y - 88);
  ctx.quadraticCurveTo(290, GROUND_Y - 80, 280, GROUND_Y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(165, GROUND_Y - 62);
  ctx.quadraticCurveTo(215, GROUND_Y - 74, 265, GROUND_Y - 62);
  ctx.stroke();
  ctx.fillStyle = '#8a5a2b';
  ctx.font = '600 20px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('চাল', 215, GROUND_Y - 22);
}

// ---------------- jungle (জঙ্গলের পথ) — Sprint 4 ----------------

function drawJungle(ctx: CanvasRenderingContext2D) {
  const horizon = 470;
  // misty green depths
  const bg = ctx.createLinearGradient(0, 0, 0, horizon);
  bg.addColorStop(0, '#dcfce7');
  bg.addColorStop(1, '#86efac');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STAGE_W, horizon);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, GROUND_Y - 8, STAGE_W, STAGE_H - GROUND_Y + 8);

  // layered canopy silhouettes
  ctx.fillStyle = 'rgba(20, 83, 45, 0.5)';
  for (let i = 0; i < 9; i++) {
    const cx = i * 160 + (i % 2) * 60;
    ctx.beginPath();
    ctx.ellipse(cx, 60 + (i % 3) * 26, 110, 52, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sprint 9 — depth fog between the far canopy and the mid layer
  haze(ctx, 0, 80, STAGE_W, 220, '190, 220, 160', 0.25);
  ctx.fillStyle = 'rgba(22, 101, 52, 0.75)';
  for (let i = 0; i < 8; i++) {
    const cx = i * 180 + 90;
    ctx.beginPath();
    ctx.ellipse(cx, 130 + (i % 2) * 30, 96, 46, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // hanging vines
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  for (const vx of [140, 330, 560, 800, 1010, 1190]) {
    const vl = 90 + ((vx * 7) % 90);
    ctx.beginPath();
    ctx.moveTo(vx, 150);
    ctx.quadraticCurveTo(vx + 10, 150 + vl * 0.6, vx - 4, 150 + vl);
    ctx.stroke();
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(vx - 4, 150 + vl + 6, 9, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprint 9 — god-rays slanting through the canopy from the top-left
  const ray = (x0: number, w0: number, a: number) => {
    const rg = ctx.createLinearGradient(0, 0, 0, 440);
    rg.addColorStop(0, `rgba(255, 246, 196, ${a})`);
    rg.addColorStop(1, 'rgba(255, 246, 196, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x0, -10);
    ctx.lineTo(x0 + w0, -10);
    ctx.lineTo(x0 + w0 + 118, 450);
    ctx.lineTo(x0 + 118, 450);
    ctx.closePath();
    ctx.fill();
  };
  ray(140, 76, 0.13);
  ray(295, 46, 0.09);
  ray(455, 62, 0.11);

  // distant trunks
  for (const tx of [110, 420, 700, 1000, 1230]) {
    softShadow(ctx, tx + 4, horizon + 32, 30, 7, 0.12);
    ctx.strokeStyle = '#6d4c2f';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(tx, horizon + 30);
    ctx.quadraticCurveTo(tx + 8, horizon - 80, tx - 4, horizon - 170);
    ctx.stroke();
  }

  // giant banyan left with aerial roots
  softShadow(ctx, 98, GROUND_Y + 12, 96, 18, 0.2);
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(80, GROUND_Y + 10);
  ctx.quadraticCurveTo(60, horizon + 40, 90, horizon - 140);
  ctx.stroke();
  ctx.lineWidth = 8;
  for (const rx of [40, 105, 130]) {
    softShadow(ctx, rx + 6, GROUND_Y + 8, 20, 5, 0.13);
    ctx.beginPath();
    ctx.moveTo(80 + (rx - 85) * 0.4, horizon - 120);
    ctx.quadraticCurveTo(rx, horizon + 10, rx + 6, GROUND_Y + 6);
    ctx.stroke();
  }
  bush(ctx, 30, horizon - 150, 3.4, '#166534');
  bush(ctx, 150, horizon - 120, 2.8, '#15803d');

  // the dirt path winding into the woods
  ctx.fillStyle = '#d9b06e';
  ctx.beginPath();
  ctx.moveTo(430, STAGE_H);
  ctx.quadraticCurveTo(500, GROUND_Y + 40, 660, GROUND_Y + 6);
  ctx.quadraticCurveTo(760, horizon + 40, 820, horizon - 20);
  ctx.lineTo(920, horizon - 20);
  ctx.quadraticCurveTo(850, GROUND_Y + 20, 900, GROUND_Y + 40);
  ctx.quadraticCurveTo(1010, GROUND_Y + 80, 1120, STAGE_H);
  ctx.closePath();
  ctx.fill();
  // Sprint 9 — soft darker edges so the path reads packed earth
  ctx.strokeStyle = 'rgba(146, 106, 54, 0.45)';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // path pebbles
  ctx.fillStyle = 'rgba(146, 106, 54, 0.5)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(500 + i * 62 + (i % 3) * 14, GROUND_Y + 30 + (i % 4) * 26, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // big leaves foreground right
  const leaf = (x: number, y: number, a: number, s: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(0, -34 * s, 17 * s, 40 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -70 * s);
    ctx.stroke();
    ctx.restore();
  };
  leaf(1160, GROUND_Y + 24, -0.5, 1.35);
  leaf(1230, GROUND_Y + 30, 0.35, 1.6);
  leaf(1090, GROUND_Y + 32, -0.15, 1.15);
  // mushrooms
  const shroom = (x: number, y: number, s: number) => {
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x - 4 * s, y - 12 * s, 8 * s, 12 * s);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(x, y - 12 * s, 11 * s, 7 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 4 * s, y - 15 * s, 2 * s, 0, Math.PI * 2);
    ctx.arc(x + 4 * s, y - 14 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  shroom(370, GROUND_Y + 14, 1.2);
  shroom(400, GROUND_Y + 20, 0.9);

  // Sprint 9 — darker foreground canopy framing the top corners
  ctx.fillStyle = 'rgba(12, 58, 32, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-40, -30, 230, 140, 0.35, 0, Math.PI * 2);
  ctx.ellipse(1320, -40, 250, 160, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- ambient life (dynamic overlay, drawn per frame) ----------------

/**
 * Draws the living layer of a background: drifting clouds, twinkling stars,
 * fireflies, water shimmer, dust motes. Called every frame with scene time.
 */
// ---------------- Phase 5 — জগৎ তৈরি ----------------

/** রেলস্টেশন — village rail platform: building, signboard, tracks, signal */
function drawStation(ctx: CanvasRenderingContext2D) {
  skyGradient(ctx, '#a7c4d4', '#f2e3c2', 500);
  // far treeline + haze
  for (let i = 0; i < 9; i++) {
    const bx = i * 150 - 40;
    bush(ctx, bx, 452 + (i % 3) * 14, 1.5 + (i % 2) * 0.5, '#4d7c4f');
  }
  haze(ctx, 0, 380, STAGE_W, 130, '226,238,244', 0.5);

  // ---- tracks beyond the platform edge ----
  ctx.fillStyle = '#6b5a48';
  ctx.fillRect(0, 470, STAGE_W, 60);
  ctx.fillStyle = '#575044';
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(i * 96 - 30, 478, 44, 10);
  }
  ctx.fillStyle = '#8f8577';
  ctx.fillRect(0, 486, STAGE_W, 7);
  ctx.fillRect(0, 516, STAGE_W, 7);

  // ---- platform slab ----
  const plat = ctx.createLinearGradient(0, 520, 0, STAGE_H);
  plat.addColorStop(0, '#c9b18f');
  plat.addColorStop(0.35, '#d8c49f');
  plat.addColorStop(1, '#b39a76');
  ctx.fillStyle = plat;
  ctx.fillRect(0, 520, STAGE_W, STAGE_H - 520);
  // platform edge kerb
  ctx.fillStyle = '#e7d7b3';
  ctx.fillRect(0, 520, STAGE_W, 12);
  ctx.fillStyle = '#a18863';
  ctx.fillRect(0, 532, STAGE_W, 4);
  // slab joints
  ctx.strokeStyle = 'rgba(120, 96, 64, 0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 170 + 40, 548);
    ctx.lineTo(i * 170 + 10, STAGE_H);
    ctx.stroke();
  }
  // yellow warning line
  ctx.fillStyle = '#e2b203';
  ctx.fillRect(0, 560, STAGE_W, 13);

  // ---- station building (behind, upper-left band) ----
  ctx.fillStyle = '#b5533c';
  ctx.fillRect(60, 300, 520, 172);
  ctx.fillStyle = '#8f3a2a';
  ctx.fillRect(40, 282, 560, 26); // roof band
  ctx.fillStyle = '#703022';
  ctx.fillRect(40, 274, 560, 12); // roof ridge
  // white trim + windows
  ctx.fillStyle = '#f3e0c0';
  ctx.fillRect(60, 352, 520, 10);
  for (let i = 0; i < 5; i++) {
    const wx = 100 + i * 104;
    ctx.fillStyle = '#2e4a5a';
    ctx.beginPath();
    ctx.roundRect(wx, 310, 58, 40, 5);
    ctx.fill();
    ctx.strokeStyle = '#f3e0c0';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
    ctx.beginPath();
    ctx.roundRect(wx + 6, 316, 46, 28, 3);
    ctx.fill();
  }
  // door arch
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.roundRect(300, 396, 76, 76, [30, 30, 0, 0]);
  ctx.fill();
  // signboard
  ctx.fillStyle = '#0f4c5c';
  ctx.beginPath();
  ctx.roundRect(150, 226, 340, 46, 8);
  ctx.fill();
  ctx.strokeStyle = '#f3e0c0';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fef3c7';
  ctx.font = '700 26px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ঠাট্টা রেলস্টেশন', 320, 250);
  // sign posts
  ctx.fillStyle = '#5c4632';
  ctx.fillRect(180, 272, 8, 30);
  ctx.fillRect(452, 272, 8, 30);

  // ---- signal post + lamp ----
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(1010, 620);
  ctx.lineTo(1010, 300);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1010, 330);
  ctx.lineTo(1076, 330);
  ctx.stroke();
  const armA = -0.5; // clear (arm up)
  ctx.save();
  ctx.translate(1076, 330);
  ctx.rotate(armA);
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.roundRect(0, -7, 58, 14, 6);
  ctx.fill();
  ctx.restore();
  // lamp (red/green aspect)
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(998, 268, 24, 40, 6);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(1010, 282, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(1010, 300, 7, 0, Math.PI * 2);
  ctx.fill();
  lightPool(ctx, 1010, 636, 220, 90, 0.16);
  softShadow(ctx, 1010, 628, 60, 16, 0.2);

  // ---- platform bench + tea stall crate ----
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.roundRect(120, 600, 190, 16, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(120, 574, 190, 12, 5);
  ctx.fill();
  for (const bx of [140, 282]) {
    ctx.fillRect(bx, 570, 10, 66);
  }
  softShadow(ctx, 215, 640, 110, 16, 0.18);
}

/** সিনেমা হল — velvet curtains, glowing screen, seat rows, projector beam */
function drawCinema(ctx: CanvasRenderingContext2D) {
  // hall walls
  const wall = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  wall.addColorStop(0, '#2b0f14');
  wall.addColorStop(0.6, '#451820');
  wall.addColorStop(1, '#2e1218');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // glowing screen
  const scr = ctx.createLinearGradient(0, 150, 0, 470);
  scr.addColorStop(0, '#e8f4ff');
  scr.addColorStop(0.5, '#cfe8ff');
  scr.addColorStop(1, '#9fc4e8');
  ctx.fillStyle = scr;
  ctx.beginPath();
  ctx.roundRect(240, 150, 800, 320, 8);
  ctx.fill();
  // on-screen landscape hint (village film!)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(240, 150, 800, 320, 8);
  ctx.clip();
  ctx.fillStyle = '#7fb8dd';
  ctx.fillRect(240, 150, 800, 120);
  ctx.fillStyle = '#5f9d4e';
  ctx.beginPath();
  ctx.moveTo(240, 400);
  ctx.quadraticCurveTo(440, 300, 640, 380);
  ctx.quadraticCurveTo(760, 420, 1040, 360);
  ctx.lineTo(1040, 470);
  ctx.lineTo(240, 470);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8de7c';
  ctx.beginPath();
  ctx.arc(880, 220, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#120a0c';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(240, 150, 800, 320, 8);
  ctx.stroke();
  lightPool(ctx, 640, 470, 420, 140, 0.22);

  // velvet curtains (heavy folds, tied open)
  const curtain = (x0: number, w: number) => {
    ctx.fillStyle = '#8c1d2c';
    ctx.beginPath();
    ctx.moveTo(x0, 90);
    ctx.quadraticCurveTo(x0 + w * 0.6, 130, x0 + w, 480);
    ctx.quadraticCurveTo(x0 + w * 0.8, 560, x0 + w * 0.55, 545);
    ctx.quadraticCurveTo(x0 + w * 0.3, 600, x0, 520);
    ctx.closePath();
    ctx.fill();
    // folds
    for (let i = 1; i < 5; i++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0 + (w / 5) * i, 120);
      ctx.quadraticCurveTo(x0 + (w / 5) * i + 10, 320, x0 + (w / 5) * i + 4, 540 - i * 14);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5c101c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, 90);
    ctx.quadraticCurveTo(x0 + w * 0.6, 130, x0 + w, 480);
    ctx.stroke();
  };
  curtain(150, 130);
  curtain(1000, 130);
  // top valance with scallops
  ctx.fillStyle = '#6d1522';
  ctx.fillRect(0, 0, STAGE_W, 96);
  for (let i = 0; i < 9; i++) {
    const cx = i * 148 + 74;
    ctx.beginPath();
    ctx.arc(cx, 96, 66, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(253, 224, 71, 0.5)';
  ctx.fillRect(0, 88, STAGE_W, 5);

  // ceiling lamps glow
  for (const lx of [320, 640, 960]) {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.16)';
    ctx.beginPath();
    ctx.arc(lx, 60, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(lx, 58, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // projector beam from the back top-right
  const beam = ctx.createLinearGradient(1180, 60, 640, 320);
  beam.addColorStop(0, 'rgba(255, 244, 214, 0.22)');
  beam.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(1186, 40);
  ctx.lineTo(1290, 96);
  ctx.lineTo(700, 400);
  ctx.lineTo(560, 380);
  ctx.closePath();
  ctx.fill();

  // floor + seat rows
  const floor = ctx.createLinearGradient(0, 520, 0, STAGE_H);
  floor.addColorStop(0, '#3a1620');
  floor.addColorStop(1, '#1e0a10');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 500, STAGE_W, STAGE_H - 500);
  const seatRow = (y: number, n: number, s: number) => {
    for (let i = 0; i < n; i++) {
      const sx = 90 + i * 118 + (y % 7);
      softShadow(ctx, sx + 40, y + 26 * s, 66 * s, 12 * s, 0.3);
      ctx.fillStyle = '#701a26';
      ctx.beginPath();
      ctx.roundRect(sx, y - 40 * s, 84 * s, 62 * s, 12 * s);
      ctx.fill();
      ctx.fillStyle = '#8c2333';
      ctx.beginPath();
      ctx.roundRect(sx + 6 * s, y - 52 * s, 72 * s, 26 * s, 10 * s);
      ctx.fill();
    }
  };
  seatRow(600, 9, 0.92);
}

/** মেলা — village fair at dusk: ferris wheel, striped tents, bunting */
function drawMela(ctx: CanvasRenderingContext2D) {
  skyGradient(ctx, '#7e5aa2', '#f2a65e', 470);
  sun(ctx, 1090, 430);
  // ferris wheel (right side)
  const fx = 1010;
  const fy = 300;
  const fr = 175;
  ctx.strokeStyle = '#4a352b';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
    ctx.stroke();
    // cabins
    const cx = fx + Math.cos(a) * (fr - 16);
    const cy = fy + Math.sin(a) * (fr - 16);
    ctx.fillStyle = ['#e11d48', '#f59e0b', '#16a34a', '#0ea5e9', '#f97316'][i % 5];
    ctx.beginPath();
    ctx.roundRect(cx - 13, cy - 4, 26, 20, 5);
    ctx.fill();
    ctx.strokeStyle = '#3f2d20';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // A-frame legs + hub
  ctx.strokeStyle = '#4a352b';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(fx - 90, 620);
  ctx.lineTo(fx, fy);
  ctx.lineTo(fx + 90, 620);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(fx, fy, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3f2d20';
  ctx.lineWidth = 3;
  ctx.stroke();

  // distant tent silhouettes
  for (const [tx, tw, tc] of [[90, 200, '#5d3a8e'], [330, 150, '#8e3a5e'], [560, 180, '#3a6e8e']] as const) {
    ctx.fillStyle = tc;
    ctx.beginPath();
    ctx.moveTo(tx, 470);
    ctx.lineTo(tx + tw / 2, 330);
    ctx.lineTo(tx + tw, 470);
    ctx.closePath();
    ctx.fill();
  }
  haze(ctx, 0, 350, STAGE_W, 140, '242,166,94', 0.4);

  // main striped tent (center-left)
  const tent = (cx: number, baseY: number, w: number, h: number, c1: string, c2: string) => {
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx, baseY - h);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3f2d20';
    ctx.lineWidth = 3;
    ctx.stroke();
    // scalloped bottom + stripes
    for (let i = 0; i < 4; i++) {
      const x0 = cx - w / 2 + (w / 4) * i;
      ctx.fillStyle = i % 2 ? c2 : c1;
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.lineTo(x0 + w / 8, baseY - h * 0.62);
      ctx.lineTo(x0 + w / 4, baseY);
      ctx.closePath();
      ctx.fill();
    }
    // flag on top
    ctx.strokeStyle = '#3f2d20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h);
    ctx.lineTo(cx, baseY - h - 26);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h - 26);
    ctx.lineTo(cx + 20, baseY - h - 19);
    ctx.lineTo(cx, baseY - h - 12);
    ctx.closePath();
    ctx.fill();
  };
  tent(220, 620, 300, 210, '#dc2626', '#fef3c7');
  tent(560, 640, 240, 170, '#0e7490', '#fef3c7');

  // stall counters
  ctx.fillStyle = '#8a5a2b';
  ctx.beginPath();
  ctx.roundRect(120, 600, 200, 46, 6);
  ctx.fill();
  ctx.strokeStyle = '#3f2d20';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['#f59e0b', '#dc2626', '#16a34a', '#e11d48'][i];
    ctx.beginPath();
    ctx.arc(150 + i * 46, 594, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // bunting across the top
  const flagCols = ['#e11d48', '#f59e0b', '#16a34a', '#0ea5e9', '#f97316', '#8b5cf6'];
  ctx.strokeStyle = 'rgba(63, 45, 32, 0.8)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-10, 40);
  ctx.quadraticCurveTo(360, 130, 700, 60);
  ctx.quadraticCurveTo(980, 10, 1290, 70);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const q = (i + 0.5) / 16;
    // sample the bunting curve approximately
    const bx = q * 1300;
    const sag = Math.sin(q * Math.PI) * 66 + Math.sin(q * Math.PI * 2) * 22;
    const by = 40 + sag * 0.6 + 12;
    ctx.fillStyle = flagCols[i % flagCols.length];
    ctx.beginPath();
    ctx.moveTo(bx - 11, by);
    ctx.lineTo(bx + 11, by);
    ctx.lineTo(bx, by + 22);
    ctx.closePath();
    ctx.fill();
  }

  // dirt ground with trampled patches
  const gnd = ctx.createLinearGradient(0, 620, 0, STAGE_H);
  gnd.addColorStop(0, '#c78d4f');
  gnd.addColorStop(1, '#a86f38');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, 620, STAGE_W, STAGE_H - 620);
  ctx.fillStyle = 'rgba(120, 78, 36, 0.35)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.ellipse(70 + i * 108, 655 + (i % 4) * 18, 40, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // stall warm light pools
  lightPool(ctx, 220, 640, 240, 80, 0.2);
  lightPool(ctx, 560, 655, 200, 70, 0.16);
}

export function drawAmbient(
  ctx: CanvasRenderingContext2D,
  name: BgName,
  t: number,
) {
  const drift = (speed: number, y: number, s: number, alpha: number, offset: number) => {
    const x = ((t * speed + offset) % (STAGE_W + 360)) - 180;
    ctx.globalAlpha = alpha;
    cloud(ctx, x, y, s);
    ctx.globalAlpha = 1;
  };

  switch (name) {
    case 'village':
      drift(14, 110, 0.9, 0.9, 0);
      drift(9, 180, 0.6, 0.75, 600);
      // birds
      ctx.strokeStyle = 'rgba(60, 50, 40, 0.7)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let i = 0; i < densityCount(3); i++) {
        const bx = ((t * 26 + i * 340) % (STAGE_W + 200)) - 100;
        const by = 130 + Math.sin(t * 2 + i) * 14 + i * 36;
        const flap = Math.sin(t * 7 + i * 2) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 9, by - flap);
        ctx.quadraticCurveTo(bx, by + 3, bx + 9, by - flap);
        ctx.stroke();
      }
      break;
    case 'field':
      drift(11, 100, 0.8, 0.85, 200);
      drift(16, 170, 0.55, 0.7, 900);
      // Sprint 9 — two butterflies wandering above the paddy, wings on a sin flap
      for (const [i, c] of [[0, '#f97316'], [1, '#e11d48']] as const) {
        const bx = 260 + i * 430 + Math.sin(t * 0.7 + i * 2.4) * 150;
        const by = 380 + i * 60 + Math.sin(t * 1.1 + i * 1.7) * 70;
        const flap = Math.sin(t * 9 + i * 3);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(Math.sin(t * 0.5 + i) * 0.2);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = c;
        const wy = 7 * (0.35 + 0.65 * Math.abs(flap));
        ctx.beginPath();
        ctx.ellipse(-5, -1, 4.5, wy, -0.6 - flap * 0.25, 0, Math.PI * 2);
        ctx.ellipse(5, -1, 4.5, wy, 0.6 + flap * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.6, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      break;
    case 'bazaar':
      drift(7, 90, 0.7, 0.6, 300);
      break;
    case 'pond':
    case 'ghat': {
      // water shimmer
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const y = 470 + i * 16;
        const x = 160 + ((i * 260 + t * 40) % 1000);
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 3 + i);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 36, y - 5, x + 76, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (name === 'ghat') drift(6, 90, 0.6, 0.5, 500);
      break;
    }
    case 'night': {
      // twinkling stars
      for (let i = 0; i < densityCount(12); i++) {
        const x = (i * 397 + 60) % STAGE_W;
        const y = 40 + ((i * 149) % 330);
        ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(t * 1.8 + i * 1.7));
        circle(ctx, x, y, 2, '#fef9c3');
      }
      ctx.globalAlpha = 1;
      // fireflies
      for (let i = 0; i < densityCount(8); i++) {
        const fx = 200 + ((i * 351 + t * 22) % 900);
        const fy = 480 + Math.sin(t * 1.4 + i * 2.1) * 60 + (i % 3) * 40;
        const glow = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.6 + i));
        ctx.globalAlpha = glow * 0.75;
        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = glow * 0.2;
        ctx.beginPath();
        ctx.arc(fx, fy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'room':
    case 'school':
    case 'rajcourt':
    case 'kitchen': {
      // floating dust motes in warm light
      for (let i = 0; i < densityCount(10); i++) {
        const x = 200 + ((i * 263 + t * 9) % 880);
        const y = 180 + Math.sin(t * 0.9 + i * 1.3) * 120 + ((i * 53) % 160);
        ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 1.6 + i);
        circle(ctx, x, y, 2.4, '#fff7ed');
      }
      ctx.globalAlpha = 1;
      if (name === 'kitchen') {
        // chula smoke + steam rising from the stove pot
        for (let i = 0; i < 4; i++) {
          const p = ((t * 0.5 + i * 0.25) % 1);
          const sx = 1075 + Math.sin(t * 1.6 + i * 2) * 16;
          const sy = 400 - p * 190;
          ctx.globalAlpha = 0.3 * (1 - p);
          circle(ctx, sx, sy, 9 + p * 17, '#e7e5e4');
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'temple': {
      // diya flames flicker + gentle incense smoke
      for (const [dx, dy] of [
        [160, GROUND_Y - 2],
        [1120, GROUND_Y - 4],
        [620, GROUND_Y + 2],
      ] as const) {
        const fl = 0.75 + 0.25 * Math.sin(t * 11 + dx);
        ctx.globalAlpha = 0.5 * fl;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(dx, dy - 6, 4.5, 8 * fl, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // incense smoke curling up from the door
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.35 + i * 0.33) % 1);
        const sx = 330 + Math.sin(t * 1.3 + i * 2.2) * 22;
        const sy = 430 - p * 150;
        ctx.globalAlpha = 0.16 * (1 - p);
        circle(ctx, sx, sy, 7 + p * 14, '#e7e5e4');
      }
      ctx.globalAlpha = 1;
      drift(6, 100, 0.6, 0.55, 700);
      break;
    }
    case 'river': {
      // water shimmer bands + drifting boat bob
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < densityCount(9); i++) {
        const y = 470 + i * 26;
        const x = 100 + ((i * 300 + t * 34) % 1100);
        ctx.globalAlpha = 0.25 + 0.3 * Math.sin(t * 3 + i * 1.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 40, y - 5, x + 84, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drift(12, 100, 0.85, 0.8, 100);
      break;
    }
    case 'jungle': {
      // drifting fireflies + falling leaves
      for (let i = 0; i < densityCount(7); i++) {
        const fx = 160 + ((i * 401 + t * 18) % 950);
        const fy = 300 + Math.sin(t * 1.5 + i * 2.3) * 110 + (i % 3) * 60;
        const glow = 0.35 + 0.55 * Math.abs(Math.sin(t * 2.2 + i));
        ctx.globalAlpha = glow * 0.7;
        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // falling leaves
      for (let i = 0; i < densityCount(5); i++) {
        const p = ((t * 0.12 + i * 0.21) % 1);
        const lx = 220 + i * 210 + Math.sin(t * 1.4 + i * 2) * 46;
        const ly = 130 + p * 430;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(t * 2.2 + i);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = ['#16a34a', '#22c55e', '#15803d', '#4ade80', '#65a30d'][i];
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'station':
      // a slow cloud of steam drifting from the far end of the platform
      drift(5, 200, 0.5, 0.35, 900);
      break;
    case 'cinema':
      // dust motes twinkling inside the projector beam
      for (let i = 0; i < densityCount(9); i++) {
        const mx = 560 + ((i * 167 + t * 10) % 620);
        const my = 90 + ((i * 97 + t * 26) % 320);
        ctx.globalAlpha = 0.16 + 0.2 * Math.abs(Math.sin(t * 2.4 + i));
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    case 'mela':
      // ferris wheel turning slowly + fair lights twinkling
      // (the wheel itself is baked; here we only add sparkle near the tents)
      for (let i = 0; i < densityCount(8); i++) {
        const lx = 130 + i * 55;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3.2 + i * 1.3));
        ctx.globalAlpha = tw;
        ctx.fillStyle = ['#fde047', '#f87171', '#4ade80', '#fdba74'][i % 4];
        ctx.beginPath();
        ctx.arc(lx, 592 + (i % 3) * 6, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
  }
}

// ---------------- Sprint 10: foreground depth layer ----------------

/**
 * A cached overlay painted AFTER the characters: dark, rich silhouettes that
 * frame the stage edges — grass, leaves, sacks, pillars. The engine drifts
 * this layer AGAINST the camera more strongly than the world parallax, so it
 * reads as standing IN FRONT of the actors (matte-painting depth, zero cost).
 * Deterministic painting → identical output in exports.
 */

function fgTuft(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < 7; i++) {
    const bx = x + i * 9 * s;
    const h = (34 + (i % 3) * 14) * s;
    const lean = (i - 3) * 5 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 4 * s, y);
    ctx.quadraticCurveTo(bx + lean * 0.5, y - h * 0.6, bx + lean, y - h);
    ctx.quadraticCurveTo(bx + lean * 0.5, y - h * 0.55, bx + 4 * s, y);
    ctx.closePath();
    ctx.fill();
  }
}

function fgLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-17 * s, -42 * s, 0, -80 * s);
  ctx.quadraticCurveTo(19 * s, -42 * s, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, -74 * s);
  ctx.stroke();
  for (let i = 1; i <= 4; i++) {
    const yy = -12 * i * s;
    const w = 12 * s * (1 - i * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(-w, yy - 7 * s);
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy - 7 * s);
    ctx.stroke();
  }
  ctx.restore();
}

function fgReed(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 7 * s, y - 40 * s, x + 3 * s, y - 74 * s);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + 3 * s, y - 83 * s, 4.6 * s, 13 * s, 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function fgLotus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.12, r * 0.5, r * 0.16, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + r * 0.9, y - r * 0.34);
  ctx.lineTo(x + r * 0.9, y + r * 0.1);
  ctx.closePath();
  ctx.fill();
}

function fgSack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 17 * s, y);
  ctx.quadraticCurveTo(x - 24 * s, y - 30 * s, x - 10 * s, y - 46 * s);
  ctx.quadraticCurveTo(x, y - 55 * s, x + 10 * s, y - 46 * s);
  ctx.quadraticCurveTo(x + 25 * s, y - 28 * s, x + 17 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - 44 * s);
  ctx.quadraticCurveTo(x, y - 48 * s, x + 9 * s, y - 44 * s);
  ctx.stroke();
}

function fgStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.3, y - ry * 0.45, rx * 0.4, ry * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function fgPillar(ctx: CanvasRenderingContext2D, x: number, color: string) {
  // tall stone pillar hugging the left edge (rajcourt framing)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 14, -24, 62, 768, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.roundRect(x + 34, -24, 14, 768, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.roundRect(x - 4 + i * 7, -20, 3, 760, 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 22, 118, 78, 20, 6);
  ctx.fill();
}

function fgDrape(ctx: CanvasRenderingContext2D, color: string) {
  // rich cloth hanging into the top-right corner (rajcourt framing)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(STAGE_W - 6, -12);
  ctx.lineTo(STAGE_W + 40, -12);
  ctx.lineTo(STAGE_W + 40, 300);
  ctx.quadraticCurveTo(STAGE_W - 16, 312, STAGE_W - 44, 262);
  ctx.quadraticCurveTo(STAGE_W - 26, 150, STAGE_W - 6, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const fx = STAGE_W - 6 + i * 16;
    ctx.beginPath();
    ctx.moveTo(fx, 4 + i * 10);
    ctx.quadraticCurveTo(fx - 8, 130 + i * 30, fx - 2, 250 - i * 24);
    ctx.stroke();
  }
}

function fgPlant(ctx: CanvasRenderingContext2D, x: number, y: number, potColor: string) {
  // potted plant silhouette (indoor framing)
  ctx.fillStyle = potColor;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 30);
  ctx.lineTo(x + 22, y - 30);
  ctx.lineTo(x + 15, y);
  ctx.lineTo(x - 15, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 30);
  ctx.lineTo(x + 22, y - 30);
  ctx.stroke();
  fgLeaf(ctx, x - 4, y - 30, 0.62, '#275e2e', 0.55);
  fgLeaf(ctx, x + 6, y - 30, 0.56, '#2f6b36', -0.5);
  fgLeaf(ctx, x, y - 30, 0.68, '#1e5227', 0.05);
}

function fgVine(ctx: CanvasRenderingContext2D, color: string) {
  // hanging vine from the top-left (jungle framing)
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, -8);
  ctx.quadraticCurveTo(58, 120, 34, 236);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const vy = 30 + i * 42;
    const vx = 28 + Math.sin(i * 1.1) * 26 + (i * 120) / 236;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(vx, vy, 13, 6.5, Math.sin(i * 2) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

const FG_RENDERERS: Record<BgName, (ctx: CanvasRenderingContext2D) => void> = {
  village(ctx) {
    fgTuft(ctx, 26, 726, 1.5, '#2f5d24');
    fgTuft(ctx, 94, 736, 1.1, '#35682a');
    fgLeaf(ctx, 1246, 730, 1.15, '#1e4d1c', -0.38);
    fgLeaf(ctx, 1186, 742, 0.85, '#256020', 0.3);
    fgTuft(ctx, 1216, 740, 1.0, '#2f5d24');
  },
  field(ctx) {
    fgTuft(ctx, 44, 730, 1.6, '#3a6b1f');
    fgTuft(ctx, 118, 744, 1.2, '#417424');
    fgTuft(ctx, 1156, 738, 1.5, '#3a6b1f');
    fgLeaf(ctx, 1240, 750, 0.9, '#2d5a1a', -0.24);
  },
  bazaar(ctx) {
    fgSack(ctx, 64, 744, 1.5, '#6b4423');
    fgSack(ctx, 126, 754, 1.0, '#7a5230');
    fgTuft(ctx, 1204, 746, 1.2, '#3f5a26');
  },
  pond(ctx) {
    fgLotus(ctx, 56, 738, 52, '#1e6b3a');
    fgLotus(ctx, 148, 758, 40, '#256f40');
    fgLotus(ctx, 118, 744, 30, '#1a5c33');
    fgReed(ctx, 1228, 752, 1.3, '#2e5e2a');
    fgReed(ctx, 1194, 764, 1.0, '#356831');
    fgReed(ctx, 1254, 762, 1.1, '#2e5e2a');
  },
  ghat(ctx) {
    fgReed(ctx, 66, 746, 1.2, '#2d5c33');
    fgReed(ctx, 98, 760, 0.95, '#35653b');
    fgStone(ctx, 1170, 750, 34, 15, '#4a4038');
    fgLotus(ctx, 1244, 748, 34, '#1e6b3a');
  },
  river(ctx) {
    fgReed(ctx, 60, 742, 1.25, '#2d5c33');
    fgReed(ctx, 1206, 756, 1.05, '#2d5c33');
    fgStone(ctx, 148, 754, 34, 14, '#3e4a3a');
    fgStone(ctx, 1168, 750, 26, 11, '#46523f');
  },
  night(ctx) {
    bush(ctx, 44, 732, 1.6, '#142a1e');
    bush(ctx, 142, 750, 1.2, '#12241a');
    bush(ctx, 1184, 744, 1.5, '#142a1e');
    fgTuft(ctx, 1122, 750, 1.1, '#173324');
  },
  room(ctx) {
    fgPlant(ctx, 66, 742, '#8a4b2a');
    fgPlant(ctx, 1216, 748, '#7c4224');
  },
  school(ctx) {
    fgPlant(ctx, 1214, 746, '#8a4b2a');
    // book stack bottom-left
    const books = ['#b3541e', '#3f6212', '#7c2d12'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = books[i];
      ctx.beginPath();
      ctx.roundRect(18 + i * 6, 712 - i * 17, 74 - i * 10, 17, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
  rajcourt(ctx) {
    fgPillar(ctx, 4, '#3d2c20');
    fgDrape(ctx, '#6b1f2a');
  },
  temple(ctx) {
    fgLeaf(ctx, 20, 738, 1.3, '#1d4d22', 0.5);
    fgLeaf(ctx, 1260, 746, 1.2, '#1d4d22', -0.5);
    fgTuft(ctx, 96, 746, 1.0, '#2c5a26');
  },
  kitchen(ctx) {
    // hanging pot rail top-right
    ctx.strokeStyle = '#4a3222';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(1010, -6);
    ctx.lineTo(1290, -6);
    ctx.stroke();
    ctx.fillStyle = '#3d2a1c';
    ctx.beginPath();
    ctx.ellipse(1078, 26, 30, 24, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1150, 34, 22, 17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1078, -6);
    ctx.lineTo(1078, 4);
    ctx.moveTo(1150, -6);
    ctx.lineTo(1150, 18);
    ctx.stroke();
    fgSack(ctx, 60, 746, 1.4, '#7a4a22');
  },
  jungle(ctx) {
    fgLeaf(ctx, -6, 764, 2.1, '#143a1c', -0.55);
    fgLeaf(ctx, 30, 700, 1.7, '#1b4a22', 0.7);
    fgLeaf(ctx, -16, 380, 1.6, '#123318', 0.9);
    fgLeaf(ctx, 1288, 730, 2.1, '#143a1c', -2.6);
    fgLeaf(ctx, 1252, 660, 1.7, '#1b4a22', 2.4);
    fgLeaf(ctx, 1296, 340, 1.6, '#123318', 2.2);
    fgVine(ctx, '#1d451f');
  },
  station(ctx) {
    fgPillar(ctx, -8, '#3d2c1e');
    fgPillar(ctx, 1274, '#3d2c1e');
    fgSack(ctx, 1226, 764, 1.3, '#6b4a26');
    fgStone(ctx, 1050, 748, 34, 13, '#3a3430');
    fgStone(ctx, 1130, 770, 26, 10, '#332e2a');
  },
  cinema(ctx) {
    // dark seat-back silhouettes framing the bottom edge
    ctx.fillStyle = '#160608';
    for (let i = -1; i < 12; i++) {
      const sx = 24 + i * 118;
      ctx.beginPath();
      ctx.roundRect(sx, 700, 96, 96, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(sx + 8, 664, 80, 52, 16);
      ctx.fill();
    }
    fgDrape(ctx, '#230a0e');
  },
  mela(ctx) {
    fgTuft(ctx, 8, 782, 1.8, '#6e4a22');
    fgTuft(ctx, 460, 770, 1.4, '#6e4a22');
    fgTuft(ctx, 900, 788, 1.7, '#5d3d1d');
    // balloon-seller silhouette on the left edge
    ctx.fillStyle = '#241505';
    ctx.beginPath();
    ctx.ellipse(36, 700, 34, 60, 0.15, 0, Math.PI * 2);
    ctx.fill();
    for (const [bx, by, bc] of [[-6, 596, '#1f2937'], [30, 570, '#1f2937'], [66, 600, '#1f2937']] as const) {
      ctx.strokeStyle = '#241505';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(36, 660);
      ctx.lineTo(bx, by + 22);
      ctx.stroke();
      ctx.fillStyle = bc;
      ctx.beginPath();
      ctx.ellipse(bx, by, 20, 25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const fgCache = new Map<string, HTMLCanvasElement>();

/**
 * Overscan margin (logical px) baked around the foreground content: the
 * engine drifts this layer ±~112px against the camera, so the canvas must
 * extend past the stage edges or empty bands would show while panning.
 */
const FG_MARGIN = 130;

/** Get (or build) the cached foreground silhouette overlay for a scene. */
export function getForegroundLayer(name: BgName): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('backgrounds require a browser');
  const ss = bgScale();
  const key = `fg:${name}:${CACHE_VERSION}:s${ss}`;
  let c = fgCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.round((STAGE_W + FG_MARGIN * 2) * ss);
    c.height = Math.round((STAGE_H + FG_MARGIN * 2) * ss);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(ss, 0, 0, ss, 0, 0);
    ctx.translate(FG_MARGIN, FG_MARGIN);
    FG_RENDERERS[name](ctx);
    lruPut(fgCache, key, c, MAX_FG_CACHED);
  }
  return c;
}

/** logical overscan size of the foreground canvas (engine draw helper) */
export const FG_OVERSCAN = FG_MARGIN;

/**
 * Sprint 10 — per-scene shadow tint: contact shadows pick up the ground
 * colour (green on grass, warm brown on dirt, cool on stone) instead of
 * generic black, which is a huge realism win for almost no cost.
 */
export function shadowTintFor(name: BgName): string {
  switch (name) {
    case 'village':
    case 'field':
    case 'night':
      return '30,40,18';
    case 'jungle':
    case 'temple':
      return '22,42,22';
    case 'station':
      return '62,50,34';
    case 'cinema':
      return '44,16,20';
    case 'mela':
      return '58,38,20';
    case 'bazaar':
    case 'kitchen':
      return '62,40,18';
    case 'pond':
    case 'ghat':
    case 'river':
      return '36,44,30';
    case 'room':
    case 'school':
      return '58,42,28';
    case 'rajcourt':
      return '52,38,22';
    default:
      return '0,0,0';
  }
}

// ---------------- registry ----------------

const RENDERERS: Record<BgName, (ctx: CanvasRenderingContext2D) => void> = {
  village: drawVillage,
  bazaar: drawBazaar,
  field: drawField,
  room: drawRoom,
  pond: drawPond,
  rajcourt: drawRajcourt,
  school: drawSchool,
  ghat: drawGhat,
  night: drawNight,
  temple: drawTemple,
  river: drawRiver,
  kitchen: drawKitchen,
  jungle: drawJungle,
  station: drawStation,
  cinema: drawCinema,
  mela: drawMela,
};

/** Get (or build) the cached background canvas. Client-side only. */
export function getBackgroundCanvas(name: BgName): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('backgrounds require a browser');
  // Sprint 8 — versioned cache key: painting changes never reuse stale canvases.
  // Phase 8 — scale in the key: switching quality rebuilds at the new sharpness.
  const ss = bgScale();
  const key = `${name}:${CACHE_VERSION}:s${ss}`;
  let c = cache.get(key);
  if (!c) {
    c = baseCanvas();
    const ctx = c.getContext('2d')!;
    ctx.setTransform(ss, 0, 0, ss, 0, 0);
    RENDERERS[name](ctx);
    lruPut(cache, key, c, MAX_BG_CACHED);
  }
  return c;
}
