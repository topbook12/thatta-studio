// ============================================================
// ঠাট্টা স্টুডিও — Stage engine: scene rendering + playback
// Canvas: 1280x720 internal resolution (also used for export)
// ============================================================

import { getBackgroundCanvas } from './backgrounds';
import { drawCharacter } from './draw';
import { basePose, computePose, easeInOut } from './pose';
import {
  GROUND_Y,
  STAGE_H,
  STAGE_W,
  type CharacterDesign,
  type PlacedCharacter,
  type Scene,
  type StageCallbacks,
} from './types';

const D = Math.PI / 180;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export class CartoonStage {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scene: Scene | null = null;
  private designs = new Map<string, CharacterDesign>();
  private durations: Record<string, number> = {}; // beatId -> seconds
  private callbacks: StageCallbacks = {};
  private playing = false;
  private beatIdx = 0;
  private beatStart = 0;
  private raf = 0;
  private animT = 0;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: StageCallbacks = {}) {
    this.canvas = canvas;
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  setCallbacks(cb: StageCallbacks) {
    this.callbacks = cb;
  }

  setScene(scene: Scene, designs: CharacterDesign[]) {
    this.scene = scene;
    this.designs = new Map(designs.map((d) => [d.id, d]));
    this.beatIdx = 0;
  }

  /** duration overrides per beat id (seconds) — used to sync TTS audio */
  setDurations(map: Record<string, number>) {
    this.durations = map;
  }

  isPlaying() {
    return this.playing;
  }

  play(): boolean {
    if (!this.scene || this.scene.beats.length === 0) return false;
    this.playing = true;
    this.beatIdx = 0;
    this.beatStart = performance.now();
    this.callbacks.onBeat?.(0, this.scene.beats[0]);
    return true;
  }

  stop() {
    this.playing = false;
  }

  private currentActor(): PlacedCharacter | null {
    if (!this.scene || !this.playing) return null;
    const beat = this.scene.beats[this.beatIdx];
    if (!beat) return null;
    return this.scene.characters.find((c) => c.uid === beat.actorUid) ?? null;
  }

  private loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.animT += dt;

    if (this.playing && this.scene) {
      const beat = this.scene.beats[this.beatIdx];
      if (!beat) {
        this.playing = false;
        this.callbacks.onFinish?.();
      } else {
        const durMs = (this.durations[beat.id] ?? beat.duration) * 1000;
        if (ts - this.beatStart >= durMs) {
          this.beatIdx += 1;
          this.beatStart = ts;
          if (this.beatIdx >= this.scene.beats.length) {
            this.playing = false;
            this.callbacks.onFinish?.();
          } else {
            this.callbacks.onBeat?.(this.beatIdx, this.scene.beats[this.beatIdx]);
          }
        }
      }
    }

    this.render();
  };

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    if (!this.scene) {
      // empty stage splash
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = '#9a3412';
      ctx.font = '700 42px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ঠাট্টা স্টুডিও', STAGE_W / 2, STAGE_H / 2 - 20);
      ctx.font = '500 26px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#c2410c';
      ctx.fillText('ক্যারেক্টার বসিয়ে কার্টুন বানানো শুরু করুন', STAGE_W / 2, STAGE_H / 2 + 28);
      return;
    }

    // background
    try {
      ctx.drawImage(getBackgroundCanvas(this.scene.background), 0, 0);
    } catch {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }

    const beat = this.playing ? this.scene.beats[this.beatIdx] : null;
    const beatElapsed = beat ? (performance.now() - this.beatStart) / 1000 : 0;
    const actor = this.currentActor();

    for (const placed of this.scene.characters) {
      const design = this.designs.get(placed.designId);
      if (!design) continue;

      const isActive = beat != null && actor != null && actor.uid === placed.uid;
      let worldX = (placed.x / 100) * STAGE_W;
      let flip = placed.flip;
      let pose;
      let t = this.animT;

      if (isActive && beat) {
        t = beatElapsed;
        const speaking = beat.text.trim().length > 0;
        pose = computePose(beat.action, t, speaking);
        if (beat.action === 'walk' && beat.moveTo != null) {
          const progress = Math.min(1, t / Math.max(0.4, this.durations[beat.id] ?? beat.duration));
          const startX = (placed.x / 100) * STAGE_W;
          const targetX = (beat.moveTo / 100) * STAGE_W;
          worldX = lerp(startX, targetX, easeInOut(progress));
          flip = targetX < startX;
        }
      } else {
        pose = computePose('idle', t, false);
      }

      const s = placed.scale;
      ctx.save();
      ctx.translate(worldX, GROUND_Y);
      ctx.scale(flip ? -s : s, s);
      drawCharacter(ctx, design, pose, t);
      ctx.restore();

      if (isActive && beat) {
        this.drawSpeakerPill(design.name, worldX, s);
      }
    }

    // subtitle
    if (beat && beat.text.trim()) {
      this.drawSubtitle(beat.text);
    }

    // watermark
    this.drawWatermark();
  }

  private drawSpeakerPill(name: string, worldX: number, s: number) {
    const ctx = this.ctx;
    const y = GROUND_Y - 232 * s - 16;
    ctx.font = '600 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(name).width + 34;
    const cx = Math.max(w / 2 + 8, Math.min(STAGE_W - w / 2 - 8, worldX));
    ctx.fillStyle = 'rgba(124, 45, 18, 0.88)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y - 19, w, 38, 19);
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.fillText(name, cx, y + 1);
  }

  private drawSubtitle(text: string) {
    const ctx = this.ctx;
    let fontSize = 30;
    ctx.font = `600 ${fontSize}px "Hind Siliguri", sans-serif`;
    const maxW = 980;
    let lines = wrapText(ctx, text, maxW);
    if (lines.length > 2) {
      fontSize = 25;
      ctx.font = `600 ${fontSize}px "Hind Siliguri", sans-serif`;
      lines = wrapText(ctx, text, maxW);
    }
    const lh = fontSize * 1.45;
    const boxH = lines.length * lh + 22;
    const boxW = Math.min(
      maxW + 56,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + 56,
    );
    const x0 = (STAGE_W - boxW) / 2;
    const y0 = STAGE_H - boxH - 14;

    ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x0, y0, boxW, boxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      ctx.fillText(line, STAGE_W / 2, y0 + 14 + lh / 2 + i * lh);
    });
  }

  private drawWatermark() {
    const ctx = this.ctx;
    ctx.font = '600 20px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = '🎬 ঠাট্টা স্টুডিও';
    const w = ctx.measureText(label).width + 26;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.roundRect(14, 14, w, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#9a3412';
    ctx.fillText(label, 27, 33);
  }
}

/** Compute a pose for a static (non-animated) preview. */
export function staticPose(): Pose2 {
  return basePose() as Pose2;
}

type Pose2 = ReturnType<typeof basePose>;

/** Character world height in px (approx, including headwear) */
export function characterHeight(scale: number): number {
  return 226 * scale;
}

export function stageXfromPct(pct: number): number {
  return (pct / 100) * STAGE_W;
}

/** helper used by the creator preview */
export function poseForAction(action: Parameters<typeof computePose>[0], t: number, speaking: boolean) {
  return computePose(action, t, speaking);
}

export { D as DEG };
