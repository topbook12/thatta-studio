// ============================================================
// ঠাট্টা স্টুডিও — Phase 4 (সাউন্ড স্টুডিও): SFX লাইব্রেরি
//
// থাপ্পড়, হাসি, দৌড়… — সব শব্দ ব্রাউজারেই তৈরি (100% offline,
// কোনো ফাইল ডাউনলোড হয় না)। AUTO_SFX_OF maps character actions
// to matching effects so a slap sound lands exactly when the
// slap animation plays — এটাই "অটো-সিঙ্ক"।
// ============================================================

import { bufferPeaks, encodeWav } from "./wav";
import type { ActionName } from "@/lib/cartoon/types";

export type SfxId =
  | "slap"
  | "laugh"
  | "boing"
  | "thud"
  | "whoosh"
  | "pop"
  | "knock"
  | "cheer"
  | "sad"
  | "tabla"
  | "gasp"
  | "sparkle"
  | "steps";

export interface SfxDef {
  id: SfxId;
  name: string;
  emoji: string;
}

export const SFX_LIST: SfxDef[] = [
  { id: "slap", name: "থাপ্পড়", emoji: "👋" },
  { id: "laugh", name: "হাসি", emoji: "😆" },
  { id: "boing", name: "বইং (লাফ)", emoji: "🦘" },
  { id: "thud", name: "ধুপ (পড়া)", emoji: "💥" },
  { id: "whoosh", name: "হুশ (দ্রুত)", emoji: "🌪️" },
  { id: "pop", name: "পপ", emoji: "🫧" },
  { id: "knock", name: "টকটক", emoji: "🚪" },
  { id: "cheer", name: "হুরুর (উদযাপন)", emoji: "🎉" },
  { id: "sad", name: "দুঃখের ট্রমবোন", emoji: "🎺" },
  { id: "tabla", name: "তবলা তাল", emoji: "🥁" },
  { id: "gasp", name: "ইসস্ (চমকে)", emoji: "😮" },
  { id: "sparkle", name: "ঝিকমিক", emoji: "✨" },
  { id: "steps", name: "হাঁটার শব্দ", emoji: "👣" },
];

export function sfxDefOf(id: string): SfxDef | null {
  return SFX_LIST.find((s) => s.id === id) ?? null;
}

/**
 * অটো-সিঙ্ক ম্যাপ — action → SFX. A beat with one of these actions
 * gets its matching sound pinned to the beat's start automatically.
 */
export function AUTO_SFX_OF(action: ActionName | string): SfxId | null {
  switch (action) {
    case "slap":
      return "slap";
    case "laugh":
      return "laugh";
    case "jump":
      return "boing";
    case "fall":
    case "kick":
      return "thud";
    case "push":
    case "turn":
      return "whoosh";
    case "walk":
    case "run":
    case "sneak":
      return "steps";
    case "dance":
    case "clap":
      return "tabla";
    case "celebrate":
      return "cheer";
    case "cry":
      return "sad";
    case "surprise":
    case "shiver":
      return "gasp";
    case "eat":
      return "pop";
    default:
      return null;
  }
}

// ---------------- synthesis ----------------

type Ctx = OfflineAudioContext;

function noiseBuffer(ctx: Ctx, dur: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  glide?: number;
  wobbleHz?: number; // LFO on frequency (spring wobble)
  wobbleDepth?: number;
}

function tone(ctx: Ctx, dest: AudioNode, t: number, dur: number, freq: number, o: ToneOpts = {}) {
  const { type = "sine", gain = 0.25, attack = 0.006, release = 0.07, glide, wobbleHz, wobbleDepth = 0 } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.linearRampToValueAtTime(Math.max(20, glide), t + dur);
  if (wobbleHz && wobbleDepth) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = wobbleHz;
    const lg = ctx.createGain();
    lg.gain.value = wobbleDepth;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function noiseBurst(
  ctx: Ctx,
  dest: AudioNode,
  nb: AudioBuffer,
  t: number,
  dur: number,
  gain: number,
  filter: { type: BiquadFilterType; from: number; to?: number; q?: number },
) {
  const src = ctx.createBufferSource();
  src.buffer = nb;
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.from, t);
  if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
  if (filter.q) f.Q.value = filter.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, 0, dur + 0.02);
}

function synth(id: SfxId): OfflineAudioContext {
  const DUR: Record<SfxId, number> = {
    slap: 0.4,
    laugh: 1.5,
    boing: 0.8,
    thud: 0.55,
    whoosh: 0.65,
    pop: 0.3,
    knock: 1.0,
    cheer: 2.0,
    sad: 1.7,
    tabla: 1.1,
    gasp: 0.75,
    sparkle: 1.1,
    steps: 1.0,
  };
  const dur = DUR[id];
  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(dur * 44100), 44100);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const nb = noiseBuffer(ctx, Math.max(2, dur + 0.2));

  switch (id) {
    case "slap": {
      // crack: instant click + bright slap noise + low-body thump
      noiseBurst(ctx, master, nb, 0.01, 0.13, 0.9, { type: "highpass", from: 1800 });
      tone(ctx, master, 0.005, 0.09, 240, { type: "triangle", gain: 0.5, glide: 90, release: 0.07 });
      tone(ctx, master, 0.02, 0.3, 110, { type: "sine", gain: 0.3, glide: 55, release: 0.24 });
      break;
    }
    case "laugh": {
      // cartoon chuckle — 6 pitch-modulated "heh" blips
      const f0 = 340;
      for (let i = 0; i < 6; i++) {
        const t = i * 0.21 + 0.02;
        const f = f0 * (1 - i * 0.055) * (i % 2 ? 1.12 : 1);
        tone(ctx, master, t, 0.13, f, { type: "sawtooth", gain: 0.16, release: 0.09, wobbleHz: 26, wobbleDepth: 18 });
        tone(ctx, master, t, 0.1, f * 2.01, { type: "square", gain: 0.045, release: 0.06 });
        noiseBurst(ctx, master, nb, t, 0.07, 0.05, { type: "bandpass", from: 1200, q: 2 });
      }
      break;
    }
    case "boing": {
      tone(ctx, master, 0.01, 0.62, 420, { type: "sine", gain: 0.34, glide: 95, release: 0.4, wobbleHz: 13, wobbleDepth: 55 });
      tone(ctx, master, 0.01, 0.5, 840, { type: "triangle", gain: 0.08, glide: 190, release: 0.35, wobbleHz: 13, wobbleDepth: 90 });
      break;
    }
    case "thud": {
      tone(ctx, master, 0.01, 0.34, 120, { type: "sine", gain: 0.6, glide: 42, release: 0.28 });
      noiseBurst(ctx, master, nb, 0.005, 0.12, 0.4, { type: "lowpass", from: 900 });
      break;
    }
    case "whoosh": {
      noiseBurst(ctx, master, nb, 0.02, 0.42, 0.34, { type: "bandpass", from: 350, to: 2600, q: 1.4 });
      noiseBurst(ctx, master, nb, 0.3, 0.3, 0.22, { type: "bandpass", from: 2600, to: 400, q: 1.4 });
      break;
    }
    case "pop": {
      tone(ctx, master, 0.01, 0.1, 420, { type: "sine", gain: 0.4, glide: 900, release: 0.08 });
      noiseBurst(ctx, master, nb, 0.01, 0.05, 0.3, { type: "highpass", from: 2400 });
      break;
    }
    case "knock": {
      const at = [0.02, 0.24, 0.5];
      at.forEach((t, i) => {
        tone(ctx, master, t, 0.11, 190 - i * 8, { type: "triangle", gain: 0.42, glide: 130, release: 0.09 });
        noiseBurst(ctx, master, nb, t, 0.06, 0.22, { type: "bandpass", from: 1500, q: 2 });
      });
      break;
    }
    case "cheer": {
      // crowd applause — dense crackle + rising yey tone cluster
      for (let i = 0; i < 46; i++) {
        const t = Math.random() * 1.7;
        noiseBurst(ctx, master, nb, t, 0.04, 0.07 + Math.random() * 0.05, { type: "highpass", from: 2000 });
      }
      noiseBurst(ctx, master, nb, 0.0, 1.9, 0.1, { type: "bandpass", from: 900, q: 0.6 });
      [523, 659, 784].forEach((f, i) =>
        tone(ctx, master, 0.1 + i * 0.12, 0.7, f, { type: "triangle", gain: 0.05, release: 0.5 }),
      );
      break;
    }
    case "sad": {
      // womp-womp-womp descending trombone wah
      const notes = [233, 207, 174];
      notes.forEach((f, i) => {
        const t = i * 0.42 + 0.02;
        tone(ctx, master, t, 0.38, f, { type: "sawtooth", gain: 0.18, glide: f * 0.82, release: 0.2, wobbleHz: 5.5, wobbleDepth: 7 });
        noiseBurst(ctx, master, nb, t, 0.34, 0.04, { type: "bandpass", from: 800, q: 1.2 });
      });
      break;
    }
    case "tabla": {
      // dha-tin-tin-dha fill
      const hits: [number, number, number][] = [
        [0.02, 0.5, 140],
        [0.22, 0.28, 460],
        [0.42, 0.28, 430],
        [0.6, 0.55, 150],
        [0.8, 0.3, 480],
      ];
      hits.forEach(([t, g, f]) => {
        tone(ctx, master, t, 0.18, f, { type: "sine", gain: g, glide: f * 0.6, release: 0.14 });
        noiseBurst(ctx, master, nb, t, 0.08, g * 0.3, { type: "bandpass", from: f * 8, q: 1.6 });
      });
      break;
    }
    case "gasp": {
      noiseBurst(ctx, master, nb, 0.03, 0.28, 0.22, { type: "bandpass", from: 500, to: 1600, q: 1.1 });
      noiseBurst(ctx, master, nb, 0.34, 0.3, 0.16, { type: "bandpass", from: 1400, to: 500, q: 1.1 });
      break;
    }
    case "sparkle": {
      [880, 1175, 1568, 2093, 2637].forEach((f, i) =>
        tone(ctx, master, 0.02 + i * 0.09, 0.22, f, { type: "sine", gain: 0.13, release: 0.16 }),
      );
      noiseBurst(ctx, master, nb, 0.02, 0.5, 0.045, { type: "highpass", from: 6000 });
      break;
    }
    case "steps": {
      [0.02, 0.28, 0.52, 0.76].forEach((t, i) => {
        noiseBurst(ctx, master, nb, t, 0.09, 0.2 + (i % 2) * 0.06, { type: "lowpass", from: 750 });
        tone(ctx, master, t, 0.07, 95, { type: "sine", gain: 0.14, glide: 60, release: 0.05 });
      });
      break;
    }
  }
  return ctx;
}

const sfxBufCache = new Map<SfxId, AudioBuffer>();
const sfxWavCache = new Map<SfxId, Blob>();
const sfxUrlCache = new Map<SfxId, string>();

/** Render an SFX (cached). */
export async function renderSfx(id: SfxId): Promise<AudioBuffer | null> {
  const hit = sfxBufCache.get(id);
  if (hit) return hit;
  try {
    const ctx = synth(id);
    const buf = await ctx.startRendering();
    sfxBufCache.set(id, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Waveform peaks (~24/s) of an SFX — timeline chips. */
export async function sfxPeaks(id: SfxId): Promise<number[] | null> {
  const buf = await renderSfx(id);
  return buf ? bufferPeaks(buf) : null;
}

/** WAV blob of an SFX — export bus + IndexedDB-free preview. */
export async function sfxWav(id: SfxId): Promise<Blob | null> {
  const hit = sfxWavCache.get(id);
  if (hit) return hit;
  const buf = await renderSfx(id);
  if (!buf) return null;
  const blob = encodeWav(buf);
  sfxWavCache.set(id, blob);
  return blob;
}

/** Cached object URL of an SFX (preview <audio> + realtime playback). */
export async function sfxUrl(id: SfxId): Promise<string | null> {
  const hit = sfxUrlCache.get(id);
  if (hit) return hit;
  const blob = await sfxWav(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  sfxUrlCache.set(id, url);
  return url;
}
