// ============================================================
// ঠাট্টা স্টুডিও — Stage engine v2: timeline playback + lip-sync
// Canvas: 1280x720 internal resolution (also used for export)
//
// New in v2:
//  • absolute scene-time clock → seek/scrub anywhere
//  • global playback rate (0.5x–2x slow-mo / fast-forward)
//  • per-beat speed multiplier + easing for walk paths
//  • audio-envelope lip-sync (real mouth movement)
//  • living backgrounds (ambient clouds/fireflies/water)
//  • drag characters directly on the stage
// ============================================================

import { drawAmbient, getBackgroundCanvas } from './backgrounds';
import { drawCharacter } from './draw';
import { basePose, computePose, easingByName } from './pose';
import {
  GROUND_Y,
  STAGE_H,
  STAGE_W,
  type CharacterDesign,
  type PlacedCharacter,
  type Scene,
  type SceneBeat,
  type StageCallbacks,
  type StageInteractions,
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
  private durations: Record<string, number> = {}; // beatId -> seconds (audio-aware)
  private envelopes: Record<string, number[]> = {}; // beatId -> mouth amplitude @24fps
  private callbacks: StageCallbacks = {};
  private interactions: StageInteractions = {};
  private playing = false;
  private rate = 1;
  private sceneTime = 0;
  private totalDuration = 0;
  private beatIdx = -1;
  private animT = 0;
  private lastTs = 0;
  private raf = 0;

  // selection / dragging
  private selectedUid: string | null = null;
  private dragUid: string | null = null;
  private dragMoved = false;

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
    this.attachPointer();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.detachPointer();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  setCallbacks(cb: StageCallbacks) {
    this.callbacks = cb;
  }

  setInteractions(it: StageInteractions) {
    this.interactions = it;
  }

  setScene(scene: Scene, designs: CharacterDesign[]) {
    this.scene = scene;
    this.designs = new Map(designs.map((d) => [d.id, d]));
    this.beatIdx = -1;
    if (this.sceneTime > 0) this.seek(0);
    this.recalcTotal();
  }

  /** duration overrides per beat id (seconds) — keeps beats in sync with TTS audio */
  setDurations(map: Record<string, number>) {
    this.durations = map;
    this.recalcTotal();
    // if we are parked beyond the new end, pull back
    if (!this.playing && this.sceneTime > this.totalDuration) {
      this.seek(this.totalDuration);
    }
  }

  /** mouth-amplitude envelopes per beat id (samples at 24 fps) */
  setEnvelopes(map: Record<string, number[]>) {
    this.envelopes = map;
  }

  /** global playback speed 0.5..2 */
  setPlaybackRate(rate: number) {
    this.rate = Math.max(0.25, Math.min(2.5, rate));
  }

  getPlaybackRate() {
    return this.rate;
  }

  getSceneTime() {
    return this.sceneTime;
  }

  getTotalDuration() {
    return this.totalDuration;
  }

  isPlaying() {
    return this.playing;
  }

  setSelected(uid: string | null) {
    this.selectedUid = uid;
  }

  private recalcTotal() {
    if (!this.scene) {
      this.totalDuration = 0;
      return;
    }
    this.totalDuration = this.scene.beats.reduce((acc, b) => {
      const dur = this.durations[b.id] ?? b.duration;
      return acc + Math.max(0.3, dur);
    }, 0);
  }

  private beatStartTimes(): number[] {
    if (!this.scene) return [];
    const starts: number[] = [];
    let acc = 0;
    for (const b of this.scene.beats) {
      starts.push(acc);
      acc += Math.max(0.3, this.durations[b.id] ?? b.duration);
    }
    return starts;
  }

  /** Jump to an absolute scene time (works while playing or paused). */
  seek(t: number) {
    if (!this.scene || this.scene.beats.length === 0) return;
    const clamped = Math.max(0, Math.min(this.totalDuration - 0.001, t));
    const starts = this.beatStartTimes();
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      if (clamped >= starts[i]) idx = i;
    }
    this.sceneTime = clamped;
    this.beatIdx = idx;
    const beat = this.scene.beats[idx];
    const offset = clamped - starts[idx];
    this.callbacks.onTime?.(clamped, idx);
    // let the app restart audio from the right offset
    this.callbacks.onBeat?.(idx, beat, Math.max(0, offset));
  }

  play(): boolean {
    if (!this.scene || this.scene.beats.length === 0) return false;
    if (this.sceneTime >= this.totalDuration - 0.02) this.sceneTime = 0;
    const starts = this.beatStartTimes();
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      if (this.sceneTime >= starts[i]) idx = i;
    }
    this.playing = true;
    this.beatIdx = idx;
    this.callbacks.onTime?.(this.sceneTime, idx);
    this.callbacks.onBeat?.(
      idx,
      this.scene.beats[idx],
      Math.max(0, this.sceneTime - starts[idx]),
    );
    return true;
  }

  pause() {
    this.playing = false;
  }

  stop() {
    this.playing = false;
    this.sceneTime = 0;
    this.beatIdx = -1;
    this.callbacks.onTime?.(0, -1);
  }

  // ---------------- pointer interactions ----------------

  private canvasX(e: PointerEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * STAGE_W;
  }

  private canvasY(e: PointerEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((e.clientY - rect.top) / rect.height) * STAGE_H;
  }

  private hitCharacter(x: number, y: number): PlacedCharacter | null {
    if (!this.scene) return null;
    for (let i = this.scene.characters.length - 1; i >= 0; i--) {
      const c = this.scene.characters[i];
      const cx = (c.x / 100) * STAGE_W;
      const s = c.scale;
      if (Math.abs(x - cx) < 60 * s && y > GROUND_Y - 245 * s && y < GROUND_Y + 14) {
        return c;
      }
    }
    return null;
  }

  private attachPointer() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  private detachPointer() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent) => {
    const hit = this.hitCharacter(this.canvasX(e), this.canvasY(e));
    if (hit) {
      this.dragUid = hit.uid;
      this.dragMoved = false;
      this.selectedUid = hit.uid;
      this.canvas.setPointerCapture(e.pointerId);
      this.interactions.onPick?.(hit.uid);
    } else {
      this.selectedUid = null;
      this.interactions.onPick?.(null);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const x = this.canvasX(e);
    const y = this.canvasY(e);
    if (this.dragUid) {
      this.dragMoved = true;
      const pct = Math.max(4, Math.min(96, (x / STAGE_W) * 100));
      this.interactions.onDrag?.(this.dragUid, pct);
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const hit = this.hitCharacter(x, y);
    this.canvas.style.cursor = hit ? 'grab' : 'default';
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragUid) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const pct = Math.max(4, Math.min(96, (this.canvasX(e) / STAGE_W) * 100));
      if (this.dragMoved) this.interactions.onDragEnd?.(this.dragUid, pct);
      this.dragUid = null;
      this.canvas.style.cursor = 'grab';
    }
  };

  // ---------------- main loop ----------------

  private loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.animT += dt * this.rate;

    if (this.playing && this.scene && this.scene.beats.length > 0) {
      this.sceneTime += dt * this.rate;
      if (this.sceneTime >= this.totalDuration) {
        this.sceneTime = this.totalDuration;
        this.beatIdx = this.scene.beats.length - 1;
        this.playing = false;
        this.callbacks.onTime?.(this.sceneTime, this.beatIdx);
        this.callbacks.onFinish?.();
      } else {
        const starts = this.beatStartTimes();
        let idx = 0;
        for (let i = 0; i < starts.length; i++) {
          if (this.sceneTime >= starts[i]) idx = i;
        }
        if (idx !== this.beatIdx) {
          this.beatIdx = idx;
          const offset = this.sceneTime - starts[idx];
          this.callbacks.onBeat?.(idx, this.scene.beats[idx], Math.max(0, offset));
        }
        this.callbacks.onTime?.(this.sceneTime, idx);
      }
    }

    this.render();
  };

  // ---------------- rendering ----------------

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

    // living background layer (clouds, fireflies, shimmer…)
    try {
      drawAmbient(ctx, this.scene.background, this.animT);
    } catch {
      /* ambient is decorative — never break the stage */
    }

    const starts = this.beatStartTimes();
    const inScene = this.playing || this.sceneTime > 0;
    const beat = inScene && this.beatIdx >= 0 ? this.scene.beats[this.beatIdx] : null;
    const beatElapsed = beat ? Math.max(0, this.sceneTime - starts[this.beatIdx]) : 0;
    const actor = beat
      ? this.scene.characters.find((c) => c.uid === beat.actorUid) ?? null
      : null;

    for (const placed of this.scene.characters) {
      const design = this.designs.get(placed.designId);
      if (!design) continue;

      const isActive = beat != null && actor != null && actor.uid === placed.uid;
      let worldX = (placed.x / 100) * STAGE_W;
      let flip = placed.flip;
      let pose = basePose();
      let t = this.animT;

      if (isActive && beat) {
        const speed = Math.max(0.25, Math.min(2.5, beat.speed ?? 1));
        t = beatElapsed * speed;
        pose = computePose(beat.action, t, beat.text.trim().length > 0);

        // ---- real lip-sync: audio envelope drives the mouth ----
        const env = this.envelopes[beat.id];
        if (env && env.length > 0 && beat.text.trim().length > 0) {
          const fi = beatElapsed * 24;
          const i0 = Math.max(0, Math.min(env.length - 1, Math.floor(fi)));
          const i1 = Math.max(0, Math.min(env.length - 1, i0 + 1));
          const frac = fi - Math.floor(fi);
          const amp = lerp(env[i0], env[i1], frac);
          pose.mouthOpen = Math.max(0.06, Math.min(1, 0.12 + amp * 1.05));
          // tiny speech head-bob for liveliness
          pose.headNod += (amp - 0.35) * 2.2;
        }

        if (
          (beat.action === 'walk' || beat.action === 'run') &&
          beat.moveTo != null
        ) {
          const dur = Math.max(0.4, this.durations[beat.id] ?? beat.duration);
          const progress = Math.min(1, beatElapsed / dur);
          const eased = easingByName(beat.easing ?? 'easeInOut')(progress);
          const startX = (placed.x / 100) * STAGE_W;
          const targetX = (beat.moveTo / 100) * STAGE_W;
          worldX = lerp(startX, targetX, eased);
          flip = targetX < startX;
        }
      } else {
        pose = computePose('idle', t, false);
      }

      const s = placed.scale;
      ctx.save();
      ctx.translate(worldX, GROUND_Y);
      ctx.scale(flip ? -s : s, s);
      drawCharacter(ctx, design, pose, t, placed.prop ?? 'none');
      ctx.restore();

      // selection ring
      if (this.selectedUid === placed.uid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.ellipse(worldX, GROUND_Y + 4, 46 * s, 11 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (isActive && beat) {
        this.drawSpeakerPill(design.name, worldX, s);
      }
    }

    // subtitle (also visible while scrubbing)
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
