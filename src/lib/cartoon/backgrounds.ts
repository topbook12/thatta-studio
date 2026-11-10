// ============================================================
// ঠাট্টা স্টুডিও — Procedural backgrounds (cached offscreen render)
// Stage: 1280 x 720, characters stand on y = GROUND_Y (636)
// ============================================================

import { GROUND_Y, STAGE_H, STAGE_W, type BgName } from './types';

const cache = new Map<BgName, HTMLCanvasElement>();

function baseCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = STAGE_W;
  c.height = STAGE_H;
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
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.beginPath();
  ctx.arc(x, y, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
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
  ctx.fillRect(0, horizon - 24, STAGE_W, 24 + (STAGE_H - horizon) * 0 + 0);
  ctx.fillStyle = '#bef264';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(0, GROUND_Y - 14, STAGE_W, STAGE_H - GROUND_Y + 14);

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

  // hay stack
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(760, GROUND_Y - 16, 34, Math.PI, Math.PI * 2);
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

  // shop stalls
  const stall = (x: number, awn1: string, awn2: string, w: number) => {
    const y = horizon + 30;
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
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(250, GROUND_Y - 12, 20, 14, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(285, GROUND_Y - 8, 14, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

// ---------------- field ----------------

function drawField(ctx: CanvasRenderingContext2D) {
  const horizon = 440;
  skyGradient(ctx, '#fffbeb', '#fed7aa', horizon);
  sun(ctx, 180, 120);
  cloud(ctx, 800, 110, 0.9);

  palm(ctx, 120, horizon + 60, 180);
  palm(ctx, 1180, horizon + 50, 200);
  palm(ctx, 1080, horizon + 70, 140);

  // paddy field bands
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(0, horizon, STAGE_W, STAGE_H - horizon);
  const rows = ['#bef264', '#a3e635', '#84cc16', '#a3e635', '#84cc16'];
  for (let i = 0; i < 6; i++) {
    const y = horizon + i * ((GROUND_Y + 40 - horizon) / 6);
    ctx.fillStyle = rows[i % rows.length];
    ctx.fillRect(0, y, STAGE_W, 14);
  }
  // rice tufts
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = 30 + (i * 1230) / 40 + ((i * 7) % 30);
    const y = GROUND_Y - 40 - ((i * 13) % 120);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y - 14);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y - 12);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
  }
  // scarecrow far left
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
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(560, 560);
  ctx.quadraticCurveTo(660, 600, 770, 560);
  ctx.quadraticCurveTo(660, 585, 560, 560);
  ctx.closePath();
  ctx.fill();

  // near bank (walking strip)
  ctx.fillStyle = '#d9f99d';
  ctx.fillRect(0, 620, STAGE_W, STAGE_H - 620);
  ctx.fillStyle = '#bef264';
  ctx.fillRect(0, GROUND_Y - 8, STAGE_W, STAGE_H - GROUND_Y + 8);
}

// ---------------- registry ----------------

const RENDERERS: Record<BgName, (ctx: CanvasRenderingContext2D) => void> = {
  village: drawVillage,
  bazaar: drawBazaar,
  field: drawField,
  room: drawRoom,
  pond: drawPond,
};

/** Get (or build) the cached background canvas. Client-side only. */
export function getBackgroundCanvas(name: BgName): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('backgrounds require a browser');
  let c = cache.get(name);
  if (!c) {
    c = baseCanvas();
    const ctx = c.getContext('2d')!;
    RENDERERS[name](ctx);
    cache.set(name, c);
  }
  return c;
}
