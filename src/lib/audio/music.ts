// ============================================================
// ঠাট্টা স্টুডিও — Phase 4 (সাউন্ড স্টুডিও): দেশি মিউজিক লাইব্রেরি
//
// 100% procedural, 100% offline — কোনো অডিও ফাইল ডাউনলোড হয় না।
// Each track is synthesized once with OfflineAudioContext and cached;
// peaks feed the timeline waveform, the WAV blob feeds playback and
// the MP4 export mixdown. Deterministic patterns (seeded), so the
// same scene always renders the same tune.
// ============================================================

import { bufferPeaks, encodeWav } from "./wav";

export type MusicTrackId =
  | "none"
  | "dholki"
  | "flute"
  | "comedy"
  | "sad"
  | "mystery"
  | "festival";

export interface MusicTrack {
  id: Exclude<MusicTrackId, "none">;
  name: string;
  emoji: string;
  desc: string;
  bpm: number;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "dholki", name: "ধামাকা ঢোল", emoji: "🥁", desc: "ঝাঁঝালো ঢোল-ঢোলকি বিট — অ্যাকশন ও ধামাকা দৃশ্যে", bpm: 126 },
  { id: "flute", name: "বাঁশির সুর", emoji: "🪈", desc: "নরম বাঁশির সুর — গ্রাম, নদী, শান্ত দৃশ্যে", bpm: 92 },
  { id: "comedy", name: "মজার সুর", emoji: "😜", desc: "দুষ্টুমি-ভরা প্লাকি সুর — ঠাট্টা ও কমেডি দৃশ্যে", bpm: 118 },
  { id: "sad", name: "দুঃখের সুর", emoji: "😢", desc: "ধীর মন-খারাপ সুর — কষ্ট ও বিচ্ছেদের দৃশ্যে", bpm: 66 },
  { id: "mystery", name: "রহস্যের আবহ", emoji: "🌫️", desc: "গুমোট ভয়ঙ্কর আবহ — চুরি ও রহস্য দৃশ্যে", bpm: 80 },
  { id: "festival", name: "উৎসবের বাজনা", emoji: "🎊", desc: "মেলা-উৎসবের বাজনা — বিয়ে ও জয়ধোঁয়ার দৃশ্যে", bpm: 138 },
];

export function musicTrackOf(id: string | undefined): MusicTrack | null {
  return MUSIC_TRACKS.find((t) => t.id === id) ?? null;
}

// ---------------- tiny synth toolkit ----------------

type Ctx = OfflineAudioContext;

/** deterministic PRNG — same tune on every render */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  glide?: number; // target freq (linear glide)
  detuneCents?: number;
}

function tone(
  ctx: Ctx,
  dest: AudioNode,
  t: number,
  dur: number,
  freq: number,
  o: ToneOpts = {},
) {
  const { type = "sine", gain = 0.2, attack = 0.008, release = 0.08, glide, detuneCents } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.linearRampToValueAtTime(Math.max(20, glide), t + dur);
  if (detuneCents) osc.detune.setValueAtTime(detuneCents, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + attack);
  g.gain.setValueAtTime(Math.max(0.001, gain), Math.max(t + attack, t + dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function kick(ctx: Ctx, dest: AudioNode, t: number, gain = 0.75, drop = 52) {
  tone(ctx, dest, t, 0.26, 150, { type: "sine", gain, glide: drop, release: 0.2 });
}

function noiseHit(
  ctx: Ctx,
  dest: AudioNode,
  nb: AudioBuffer,
  t: number,
  dur: number,
  gain: number,
  hpHz = 3000,
) {
  const src = ctx.createBufferSource();
  src.buffer = nb;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = hpHz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hp).connect(g).connect(dest);
  src.start(t, Math.random() * (nb.duration - dur - 0.01), dur + 0.01);
}

function skinHit(
  ctx: Ctx,
  dest: AudioNode,
  nb: AudioBuffer,
  t: number,
  gain = 0.35,
  bodyHz = 190,
) {
  const src = ctx.createBufferSource();
  src.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = bodyHz;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(bp).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5, 0.16);
  tone(ctx, dest, t, 0.1, bodyHz, { type: "sine", gain: gain * 0.5, release: 0.08 });
}

/** komal-ga minor pentatonic (Bhairavi-flavoured) ratios over Sa */
const SCALE = [1, 32 / 27, 4 / 3, 3 / 2, 16 / 9, 2];
const SA = 261.63; // C4

function nf(deg: number, oct = 0): number {
  const idx = ((deg % SCALE.length) + SCALE.length) % SCALE.length;
  const octs = Math.floor(deg / SCALE.length) + oct;
  return SA * SCALE[idx] * Math.pow(2, octs);
}

// ---------------- per-track scheduling ----------------

function scheduleTrack(
  ctx: Ctx,
  master: GainNode,
  id: MusicTrack["id"],
  dur: number,
) {
  const rnd = mulberry(id.length * 7919 + id.charCodeAt(0) * 131);
  const nb = noiseBuffer(ctx, 2);
  const beat = 60 / MUSIC_TRACKS.find((t) => t.id === id)!.bpm;
  const e8 = beat / 2; // eighth note
  const tEnd = dur - 0.15;
  const R = (p: number) => rnd() < p;

  if (id === "dholki") {
    // classic ধামাকা: dha-ge-na-dhi pattern in 8 beats
    for (let t = 0; t < tEnd; t += beat * 2) {
      kick(ctx, master, t, 0.8);
      skinHit(ctx, master, nb, t + e8 * 1.5, 0.3);
      kick(ctx, master, t + beat, 0.55, 60);
      skinHit(ctx, master, nb, t + beat + e8, 0.42, 230);
      skinHit(ctx, master, nb, t + beat + e8 * 3, 0.36, 190);
      if (R(0.5)) skinHit(ctx, master, nb, t + e8 * 0.5, 0.18, 320);
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 0 || R(0.4))
          noiseHit(ctx, master, nb, t + e8 * i, 0.045, 0.09 + (i % 4) * 0.02, 5500);
      }
    }
    // occasional তাসা horn call
    for (let t = beat * 8; t < tEnd; t += beat * 16) {
      tone(ctx, master, t, beat * 1.6, nf(4, 1), { type: "sawtooth", gain: 0.07, release: 0.4 });
      tone(ctx, master, t + beat * 2, beat * 1.4, nf(2, 1), { type: "sawtooth", gain: 0.07, release: 0.3 });
    }
  } else if (id === "flute") {
    // drone (tanpura Sa–Pa) + lilting melody
    for (let t = 0; t < tEnd; t += beat * 8) {
      tone(ctx, master, t, beat * 8, SA / 2, { type: "sine", gain: 0.06, release: 1.2 });
      tone(ctx, master, t, beat * 8, SA * 1.5 / 2, { type: "sine", gain: 0.045, release: 1.2, detuneCents: 6 });
    }
    const mel = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 4, 3, 2, 1, 0, 0];
    let i = 0;
    for (let t = beat * 0.5; t < tEnd; t += beat) {
      const deg = mel[i++ % mel.length];
      const f = nf(deg, deg >= 4 ? 1 : 0);
      tone(ctx, master, t, beat * 0.9, f, { type: "triangle", gain: 0.14, release: 0.3, detuneCents: -4 });
      tone(ctx, master, t, beat * 0.9, f * 2, { type: "sine", gain: 0.03, release: 0.25 });
      if (i % 4 === 0) skinHit(ctx, master, nb, t, 0.1, 260);
    }
  } else if (id === "comedy") {
    // mischievous staccato plucks + bouncy bass
    const pat = [0, 0, 2, 3, 0, 3, 2, 0, 4, 3, 2, 0, 3, 0, 2, 0];
    let i = 0;
    for (let t = 0; t < tEnd; t += e8) {
      const deg = pat[i % pat.length];
      i++;
      if (deg !== 0 || i % 4 < 2) {
        tone(ctx, master, t, e8 * 0.8, nf(deg, 1), {
          type: "square", gain: 0.055, release: 0.05, glide: nf(deg, 1) * 0.995,
        });
      }
      if (i % 2 === 1) {
        tone(ctx, master, t, e8 * 0.9, nf(i % 8 < 4 ? 0 : 4, -1), {
          type: "triangle", gain: 0.16, release: 0.06,
        });
      }
      if (i % 4 === 2) kick(ctx, master, t, 0.3, 70);
      if (i % 2 === 0) noiseHit(ctx, master, nb, t, 0.03, 0.05, 6000);
    }
    // sneaky slide every 4 bars
    for (let t = beat * 6; t < tEnd; t += beat * 12) {
      tone(ctx, master, t, beat * 1.2, nf(0, 1), { type: "sawtooth", gain: 0.06, glide: nf(5, 1), release: 0.2 });
    }
  } else if (id === "sad") {
    // slow flute over a deep drone, spacey rests
    for (let t = 0; t < tEnd; t += beat * 4) {
      tone(ctx, master, t, beat * 4, SA / 2, { type: "sine", gain: 0.05, release: 1.6 });
      tone(ctx, master, t, beat * 4, SA * 0.75 / 2, { type: "sine", gain: 0.035, release: 1.6 });
    }
    const mel = [4, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, -3];
    let i = 0;
    for (let t = beat; t < tEnd; t += beat * 1.5) {
      const deg = mel[i++ % mel.length];
      tone(ctx, master, t, beat * 1.4, nf(deg, 0), { type: "triangle", gain: 0.12, release: 0.7, detuneCents: -6 });
      tone(ctx, master, t, beat * 1.2, nf(deg, 0) * 2.002, { type: "sine", gain: 0.025, release: 0.5 });
    }
    // one teardrop piano-ish note every 4 bars
    for (let t = beat * 6; t < tEnd; t += beat * 8) {
      tone(ctx, master, t, beat * 2, nf(0, 1), { type: "sine", gain: 0.06, release: 1.4 });
    }
  } else if (id === "mystery") {
    // low drone + heartbeat + minor-second shiver + high tremolo stabs
    for (let t = 0; t < tEnd; t += beat * 8) {
      tone(ctx, master, t, beat * 8, nf(0, -1), { type: "sawtooth", gain: 0.05, release: 2 });
      tone(ctx, master, t, beat * 8, nf(0, -1) * 1.06, { type: "sawtooth", gain: 0.04, release: 2 });
    }
    for (let t = 0; t < tEnd; t += beat) {
      kick(ctx, master, t, 0.3, 40);
      if (Math.floor(t / beat) % 8 === 7) kick(ctx, master, t + e8, 0.25, 40);
    }
    for (let t = beat * 4; t < tEnd; t += beat * 8) {
      for (let k = 0; k < 6; k++)
        tone(ctx, master, t + k * 0.055, 0.1, nf(2, 2), { type: "sine", gain: 0.05, release: 0.08 });
      tone(ctx, master, t + 0.45, beat * 1.5, nf(1, 2), { type: "sine", gain: 0.045, release: 1 });
    }
  } else {
    // festival — fast dhol + celebratory melody + cymbal rolls
    for (let t = 0; t < tEnd; t += beat * 2) {
      kick(ctx, master, t, 0.85);
      skinHit(ctx, master, nb, t + e8, 0.34, 240);
      skinHit(ctx, master, nb, t + e8 * 2, 0.2, 300);
      kick(ctx, master, t + beat, 0.6, 58);
      skinHit(ctx, master, nb, t + beat + e8 * 3, 0.4, 210);
      for (let i = 0; i < 8; i++)
        if (i % 2 === 1) noiseHit(ctx, master, nb, t + e8 * i, 0.05, 0.1, 5200);
    }
    const mel = [0, 2, 3, 4, 3, 2, 3, 0, 2, 4, 5, 4, 3, 4, 2, 0];
    let i = 0;
    for (let t = 0; t < tEnd; t += e8) {
      const deg = mel[i++ % mel.length];
      tone(ctx, master, t, e8 * 0.85, nf(deg, 1), { type: "square", gain: 0.05, release: 0.06 });
      if (i % 4 === 1) tone(ctx, master, t, e8 * 1.6, nf(deg, 0), { type: "triangle", gain: 0.08, release: 0.15 });
    }
    // shehnai-ish swell every 8 bars
    for (let t = beat * 8; t < tEnd; t += beat * 16) {
      tone(ctx, master, t, beat * 2.2, nf(4, 1), { type: "sawtooth", gain: 0.06, release: 0.5, detuneCents: 8 });
      tone(ctx, master, t + beat * 2.3, beat * 1.8, nf(2, 1), { type: "sawtooth", gain: 0.06, release: 0.4 });
    }
  }
}

// ---------------- render + cache ----------------

const bufCache = new Map<string, AudioBuffer>();
const wavCache = new Map<string, Blob>();
const urlCache = new Map<string, string>();
const MAX_SECONDS = 120;

async function offlineCtx(seconds: number, sampleRate = 44100): Promise<OfflineAudioContext> {
  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  return new OAC(1, Math.ceil(seconds * sampleRate), sampleRate);
}

/** Render a music track for `seconds` (cached per id+rounded seconds). */
export async function renderMusic(id: MusicTrackId, seconds: number): Promise<AudioBuffer | null> {
  const track = musicTrackOf(id);
  if (!track) return null;
  const dur = Math.max(2, Math.min(MAX_SECONDS, seconds + 0.4));
  const key = `${id}:${Math.ceil(dur)}`;
  const hit = bufCache.get(key);
  if (hit) return hit;
  const ctx = await offlineCtx(dur);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  try {
    scheduleTrack(ctx, master, track.id, dur);
    const buf = await ctx.startRendering();
    bufCache.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Waveform peaks (~24/s) of a rendered track — for the timeline row. */
export async function musicPeaks(id: MusicTrackId, seconds: number): Promise<number[] | null> {
  const buf = await renderMusic(id, seconds);
  return buf ? bufferPeaks(buf) : null;
}

/** WAV blob of a rendered track — playback + MP4 export bus. */
export async function musicWav(id: MusicTrackId, seconds: number): Promise<Blob | null> {
  const dur = Math.max(2, Math.min(MAX_SECONDS, seconds + 0.4));
  const key = `${id}:${Math.ceil(dur)}`;
  const hit = wavCache.get(key);
  if (hit) return hit;
  const buf = await renderMusic(id, dur);
  if (!buf) return null;
  const blob = encodeWav(buf);
  wavCache.set(key, blob);
  return blob;
}

/** Object URL for an <audio>-playable music segment (cached, one URL per track). */
export async function musicUrl(id: MusicTrackId, seconds: number): Promise<string | null> {
  const dur = Math.max(2, Math.min(MAX_SECONDS, seconds + 0.4));
  const key = `${id}:${Math.ceil(dur)}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await musicWav(id, dur);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}
