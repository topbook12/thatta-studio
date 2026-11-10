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

  // alphabet chart on wall
  ctx.fillStyle = '#fca5a5';
  rr(ctx, 60, 360, 0, 0, 4);
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
    ctx.fillStyle = '#e7d3b1';
  }

  // umbrella by the steps
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

  // boat
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

  // near bank strip (walkable)
  ctx.fillStyle = '#e7d3b1';
  ctx.fillRect(0, 560, STAGE_W, STAGE_H - 560);
  ctx.fillStyle = '#d9c193';
  ctx.fillRect(0, GROUND_Y - 6, STAGE_W, STAGE_H - GROUND_Y + 6);
  // steps edge
  ctx.fillStyle = '#c9a86e';
  ctx.fillRect(0, 552, STAGE_W, 10);
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

  // moon
  circle(ctx, 1050, 120, 52, '#fef08a');
  circle(ctx, 1032, 108, 10, 'rgba(202, 138, 4, 0.35)');
  circle(ctx, 1064, 132, 7, 'rgba(202, 138, 4, 0.3)');
  circle(ctx, 1058, 96, 5, 'rgba(202, 138, 4, 0.3)');
  // moon glow
  const mg = ctx.createRadialGradient(1050, 120, 40, 1050, 120, 140);
  mg.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
  mg.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = mg;
  ctx.fillRect(910, -20, 280, 280);

  // distant trees
  ctx.fillStyle = '#1e293b';
  bush(ctx, 160, 430, 2.4, '#1e293b');
  bush(ctx, 1000, 440, 2.0, '#1e293b');

  // ground
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 470, STAGE_W, STAGE_H - 470);
  ctx.fillStyle = '#3730a3';
  ctx.fillRect(0, GROUND_Y - 12, STAGE_W, STAGE_H - GROUND_Y + 12);

  // hut with lit window
  const hx = 120;
  const hy = 470;
  ctx.fillStyle = '#44403c';
  rr(ctx, hx, hy + 20, 250, 140, 6);
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.moveTo(hx - 34, hy + 28);
  ctx.quadraticCurveTo(hx + 125, hy - 70, hx + 284, hy + 28);
  ctx.closePath();
  ctx.fill();
  // warm glowing window
  ctx.fillStyle = '#fde047';
  rr(ctx, hx + 50, hy + 60, 52, 46, 4);
  const wg = ctx.createRadialGradient(hx + 76, hy + 83, 10, hx + 76, hy + 83, 110);
  wg.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
  wg.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = wg;
  ctx.fillRect(hx - 40, hy - 30, 240, 240);
  // door
  ctx.fillStyle = '#1c1917';
  rr(ctx, hx + 160, hy + 70, 60, 90, 4);
  // chimney smoke base
  ctx.fillStyle = '#44403c';
  rr(ctx, hx + 200, hy - 30, 26, 46, 3);

  // second hut far right
  ctx.fillStyle = '#3f3f46';
  rr(ctx, 950, 520, 190, 108, 6);
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(926, 526);
  ctx.quadraticCurveTo(1045, 452, 1164, 526);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  rr(ctx, 1000, 550, 40, 36, 3);

  // pond reflection
  ctx.fillStyle = 'rgba(129, 140, 248, 0.18)';
  ctx.beginPath();
  ctx.ellipse(640, 660, 200, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- ambient life (dynamic overlay, drawn per frame) ----------------

/**
 * Draws the living layer of a background: drifting clouds, twinkling stars,
 * fireflies, water shimmer, dust motes. Called every frame with scene time.
 */
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
      for (let i = 0; i < 3; i++) {
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
      for (let i = 0; i < 12; i++) {
        const x = (i * 397 + 60) % STAGE_W;
        const y = 40 + ((i * 149) % 330);
        ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(t * 1.8 + i * 1.7));
        circle(ctx, x, y, 2, '#fef9c3');
      }
      ctx.globalAlpha = 1;
      // fireflies
      for (let i = 0; i < 8; i++) {
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
    case 'rajcourt': {
      // floating dust motes in warm light
      for (let i = 0; i < 10; i++) {
        const x = 200 + ((i * 263 + t * 9) % 880);
        const y = 180 + Math.sin(t * 0.9 + i * 1.3) * 120 + ((i * 53) % 160);
        ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 1.6 + i);
        circle(ctx, x, y, 2.4, '#fff7ed');
      }
      ctx.globalAlpha = 1;
      break;
    }
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
