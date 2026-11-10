// ============================================================
// ঠাট্টা স্টুডিও — Stage engine v3: parallel multi-track playback
// Canvas: 1280x720 internal resolution (also used for export)
//
// New in v3:
//  • absolute beat windows → PARALLEL tracks (multi-character scenes!)
//  • per-beat onBeatStart/onBeatEnd → overlapping voices just work
//  • deterministic walk chains: a walk starts where the previous one ended
//  • walk-target flag: drag the green flag on the stage to set destination
//  • same premium motion core: speed, easing, lip-sync, living backgrounds
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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** sequential start fallback for beats without an absolute `start` */
function seqStart(beats: SceneBeat[], i: number): number {
  let acc = 0;
  for (let j = 0; j < i; j++) acc += Math.max(0.3, beats[j].duration);
  return acc;
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

/** A beat scheduled on the absolute timeline: [start, end) in seconds. */
interface BeatWindow {
  beat: SceneBeat;
  idx: number;
  start: number;
  end: number;
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
  private animT = 0;
  private lastTs = 0;
  private raf = 0;
  /** ids of beat windows currently active (drives audio start/end diffing) */
  private activeIds = new Set<string>();
  /** the beat whose walk-target flag is editable on stage */
  private editBeatId: string | null = null;

  // selection / dragging
  private selectedUid: string | null = null;
  private dragUid: string | null = null;
  private dragMoved = false;
  private flagDrag = false;

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
    // keep the editable walk-flag if its beat still exists and is a walk/run
    if (this.editBeatId) {
      const b = scene.beats.find((x) => x.id === this.editBeatId);
      if (!b || (b.action !== 'walk' && b.action !== 'run')) this.editBeatId = null;
    }
    if (this.scene.beats.length === 0) {
      this.sceneTime = 0;
      this.activeIds.clear();
      this.callbacks.onTime?.(0, 0);
      return;
    }
    // preserve the playhead position across scene edits (never rewind!)
    const total = this.totalDuration();
    const clamped = Math.min(this.sceneTime, Math.max(0, total - 0.001));
    if (Math.abs(clamped - this.sceneTime) > 0.001) {
      this.seek(clamped);
    } else {
      // re-sync active windows for the new layout (no audio restart)
      const active = this.activeAt(this.layout(), this.sceneTime);
      this.activeIds = new Set(active.map((w) => w.beat.id));
      this.callbacks.onTime?.(this.sceneTime, active.length);
    }
  }

  /** duration overrides per beat id (seconds) — keeps beats in sync with TTS audio */
  setDurations(map: Record<string, number>) {
    this.durations = map;
    if (!this.playing && this.sceneTime > 0) {
      const total = this.totalDuration();
      if (this.sceneTime > total) this.seek(Math.max(0, total - 0.001));
    }
  }

  /** mouth-amplitude envelopes per beat id (samples at 24 fps) */
  setEnvelopes(map: Record<string, number[]>) {
    this.envelopes = map;
  }

  /** global playback speed 0.25..2.5 */
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
    return this.totalDuration();
  }

  isPlaying() {
    return this.playing;
  }

  setSelected(uid: string | null) {
    this.selectedUid = uid;
  }

  /** which beat's walk-target flag should be visible/draggable on stage */
  setEditBeat(beatId: string | null) {
    this.editBeatId = beatId;
  }

  // ---------------- timeline layout ----------------

  /** All beat windows sorted by start time (parallel-safe). */
  private layout(): BeatWindow[] {
    if (!this.scene) return [];
    const beats = this.scene.beats;
    const wins = beats.map((b, i) => {
      const start =
        typeof b.start === 'number' && b.start >= 0 ? b.start : seqStart(beats, i);
      const dur = Math.max(0.3, this.durations[b.id] ?? b.duration);
      return { beat: b, idx: i, start, end: start + dur } as BeatWindow;
    });
    wins.sort((a, b) => a.start - b.start || a.idx - b.idx);
    return wins;
  }

  private totalDuration(): number {
    let total = 0;
    for (const w of this.layout()) total = Math.max(total, w.end);
    return total;
  }

  private activeAt(wins: BeatWindow[], t: number): BeatWindow[] {
    return wins.filter((w) => w.start <= t && t < w.end);
  }

  /**
   * Where does this character stand at scene time `t`?
   * Deterministic walk-chain: x = the destination of the latest walk that
   * already finished before t (so chained walks never teleport).
   */
  private charXAt(uid: string, t: number, placed: PlacedCharacter): number {
    let x = (placed.x / 100) * STAGE_W;
    let best: BeatWindow | null = null;
    for (const w of this.layout()) {
      if (
        w.beat.actorUid === uid &&
        (w.beat.action === 'walk' || w.beat.action === 'run') &&
        w.beat.moveTo != null &&
        w.end <= t + 1e-6
      ) {
        if (!best || w.end > best.end) best = w;
      }
    }
    if (best && best.beat.moveTo != null) x = (best.beat.moveTo / 100) * STAGE_W;
    return x;
  }

  // ---------------- transport ----------------

  /** Jump to an absolute scene time (works while playing or paused). */
  seek(t: number) {
    const wins = this.layout();
    if (wins.length === 0) return;
    const total = this.totalDuration();
    const clamped = clamp(t, 0, Math.max(0, total - 0.001));
    this.sceneTime = clamped;
    const active = this.activeAt(wins, clamped);
    const newIds = new Set(active.map((w) => w.beat.id));

    if (this.playing) {
      for (const id of this.activeIds) {
        if (!newIds.has(id)) {
          const w = wins.find((x) => x.beat.id === id);
          if (w) this.callbacks.onBeatEnd?.(w.beat);
        }
      }
      for (const w of active) {
        if (!this.activeIds.has(w.beat.id)) {
          this.callbacks.onBeatStart?.(w.beat, Math.max(0, clamped - w.start));
        }
      }
    }
    this.activeIds = newIds;
    this.callbacks.onTime?.(clamped, active.length);
  }

  play(): boolean {
    const wins = this.layout();
    if (wins.length === 0) return false;
    if (this.sceneTime >= this.totalDuration() - 0.02) this.sceneTime = 0;
    const active = this.activeAt(wins, this.sceneTime);
    this.playing = true;
    this.activeIds = new Set(active.map((w) => w.beat.id));
    for (const w of active) {
      this.callbacks.onBeatStart?.(w.beat, Math.max(0, this.sceneTime - w.start));
    }
    this.callbacks.onTime?.(this.sceneTime, active.length);
    return true;
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    const wins = this.layout();
    for (const id of this.activeIds) {
      const w = wins.find((x) => x.beat.id === id);
      if (w) this.callbacks.onBeatEnd?.(w.beat);
    }
    this.activeIds = new Set();
  }

  stop() {
    this.pause();
    this.sceneTime = 0;
    this.callbacks.onTime?.(0, 0);
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

  /** x of the editable walk-target flag, or null when not shown */
  private flagX(): number | null {
    if (this.playing || !this.editBeatId || !this.scene) return null;
    const beat = this.scene.beats.find((b) => b.id === this.editBeatId);
    if (!beat) return null;
    if (beat.action !== 'walk' && beat.action !== 'run') return null;
    if (beat.moveTo == null) return null;
    return (beat.moveTo / 100) * STAGE_W;
  }

  private overFlag(x: number, y: number): boolean {
    const fx = this.flagX();
    if (fx == null) return false;
    return Math.abs(x - fx) <= 30 && y >= GROUND_Y - 92 && y <= GROUND_Y + 18;
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
    const x = this.canvasX(e);
    const y = this.canvasY(e);
    // walk-target flag has priority
    if (this.overFlag(x, y)) {
      this.flagDrag = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.interactions.onDragTarget?.(clamp((x / STAGE_W) * 100, 4, 96));
      this.canvas.style.cursor = 'ew-resize';
      return;
    }
    const hit = this.hitCharacter(x, y);
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
    if (this.flagDrag) {
      this.interactions.onDragTarget?.(clamp((x / STAGE_W) * 100, 4, 96));
      this.canvas.style.cursor = 'ew-resize';
      return;
    }
    if (this.dragUid) {
      this.dragMoved = true;
      const pct = clamp((x / STAGE_W) * 100, 4, 96);
      this.interactions.onDrag?.(this.dragUid, pct);
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.overFlag(x, y)) {
      this.canvas.style.cursor = 'ew-resize';
      return;
    }
    const hit = this.hitCharacter(x, y);
    this.canvas.style.cursor = hit ? 'grab' : 'default';
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.flagDrag) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.flagDrag = false;
      const pct = clamp((this.canvasX(e) / STAGE_W) * 100, 4, 96);
      this.interactions.onDragTargetEnd?.(pct);
      this.canvas.style.cursor = 'default';
      return;
    }
    if (this.dragUid) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const pct = clamp((this.canvasX(e) / STAGE_W) * 100, 4, 96);
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
      const wins = this.layout();
      const total = this.totalDuration();
      if (this.sceneTime >= total) {
        this.sceneTime = total;
        const stillActive = wins.filter((w) => this.activeIds.has(w.beat.id));
        for (const w of stillActive) this.callbacks.onBeatEnd?.(w.beat);
        this.activeIds.clear();
        this.playing = false;
        this.callbacks.onTime?.(this.sceneTime, 0);
        this.callbacks.onFinish?.();
      } else {
        const active = this.activeAt(wins, this.sceneTime);
        const newIds = new Set(active.map((w) => w.beat.id));
        for (const id of this.activeIds) {
          if (!newIds.has(id)) {
            const w = wins.find((x) => x.beat.id === id);
            if (w) this.callbacks.onBeatEnd?.(w.beat);
          }
        }
        for (const w of active) {
          if (!this.activeIds.has(w.beat.id)) {
            this.callbacks.onBeatStart?.(w.beat, Math.max(0, this.sceneTime - w.start));
          }
        }
        this.activeIds = newIds;
        this.callbacks.onTime?.(this.sceneTime, active.length);
      }
    }

    this.render();
  };

  // ---------------- rendering ----------------

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    if (!this.scene || this.scene.beats.length === 0) {
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
      ctx.fillText(
        'ক্যারেক্টার বসিয়ে কার্টুন বানানো শুরু করুন',
        STAGE_W / 2,
        STAGE_H / 2 + 28,
      );
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

    const t = this.sceneTime;
    const inScene = this.playing || t > 0;
    const wins = this.layout();
    const active = inScene ? this.activeAt(wins, t) : [];

    // one active window per actor (latest start wins)
    const activeByActor = new Map<string, BeatWindow>();
    for (const w of active) {
      const prev = activeByActor.get(w.beat.actorUid);
      if (!prev || w.start > prev.start) activeByActor.set(w.beat.actorUid, w);
    }

    for (const placed of this.scene.characters) {
      const design = this.designs.get(placed.designId);
      if (!design) continue;

      const w = inScene ? (activeByActor.get(placed.uid) ?? null) : null;
      let worldX = this.charXAt(placed.uid, inScene ? t : 0, placed);
      let flip = placed.flip;
      let pose = basePose();
      let localT = this.animT;

      if (w) {
        const beat = w.beat;
        const beatElapsed = Math.max(0, t - w.start);
        const speed = clamp(beat.speed ?? 1, 0.25, 2.5);
        localT = beatElapsed * speed;
        pose = computePose(beat.action, localT, beat.text.trim().length > 0);

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
          const dur = Math.max(0.3, w.end - w.start);
          const progress = Math.min(1, beatElapsed / dur);
          const eased = easingByName(beat.easing ?? 'easeInOut')(progress);
          const startX = this.charXAt(placed.uid, w.start, placed);
          const targetX = (beat.moveTo / 100) * STAGE_W;
          worldX = lerp(startX, targetX, eased);
          flip = targetX < startX;
        }
      } else {
        pose = computePose('idle', localT, false);
      }

      const s = placed.scale;
      ctx.save();
      ctx.translate(worldX, GROUND_Y);
      ctx.scale(flip ? -s : s, s);
      drawCharacter(ctx, design, pose, localT, placed.prop ?? 'none');
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

      if (w) {
        this.drawSpeakerPill(design.name, worldX, s);
      }
    }

    // walk-target flag (only while paused + an editable walk beat selected)
    if (!this.playing && this.editBeatId) {
      const w = wins.find((x) => x.beat.id === this.editBeatId);
      if (
        w &&
        (w.beat.action === 'walk' || w.beat.action === 'run') &&
        w.beat.moveTo != null
      ) {
        const actor = this.scene.characters.find((c) => c.uid === w.beat.actorUid);
        const fromX = actor
          ? this.charXAt(w.beat.actorUid, w.start, actor)
          : STAGE_W / 2;
        this.drawWalkFlag(fromX, w.beat.moveTo);
      }
    }

    // subtitle: the most recently started active beat with dialogue
    let sub: BeatWindow | null = null;
    for (const w of active) {
      if (w.beat.text.trim() && (!sub || w.start > sub.start)) sub = w;
    }
    if (sub) {
      this.drawSubtitle(sub.beat.text);
    }

    // watermark
    this.drawWatermark();
  }

  private drawWalkFlag(fromX: number, moveToPct: number) {
    const ctx = this.ctx;
    const flagX = (moveToPct / 100) * STAGE_W;
    ctx.save();

    // dashed walk path along the ground
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(fromX, GROUND_Y + 6);
    ctx.lineTo(flagX, GROUND_Y + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // pole
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(flagX, GROUND_Y + 6);
    ctx.lineTo(flagX, GROUND_Y - 64);
    ctx.stroke();

    // pennant
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(flagX, GROUND_Y - 64);
    ctx.lineTo(flagX + 46, GROUND_Y - 52);
    ctx.lineTo(flagX, GROUND_Y - 40);
    ctx.closePath();
    ctx.fill();

    // draggable base knob
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(flagX, GROUND_Y + 6, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ecfdf5';
    ctx.lineWidth = 3;
    ctx.stroke();

    // label
    ctx.font = '600 17px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelX = clamp(flagX, 120, STAGE_W - 150);
    ctx.fillStyle = 'rgba(6, 95, 70, 0.92)';
    const label = 'গন্তব্য — টেনে বদলান';
    const w = ctx.measureText(label).width + 20;
    ctx.beginPath();
    ctx.roundRect(labelX - w / 2, GROUND_Y - 92, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ecfdf5';
    ctx.fillText(label, labelX, GROUND_Y - 78);

    ctx.restore();
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
export function poseForAction(
  action: Parameters<typeof computePose>[0],
  t: number,
  speaking: boolean,
) {
  return computePose(action, t, speaking);
}

export { D as DEG };
