// ============================================================
// ঠাট্টা স্টুডিও — TTS audio cache + VISEME lip-sync analysis
// Each generated voice line is decoded once; we keep:
//  • duration (accurate, from decoded PCM)
//  • waveform peaks (~24/sec) for the timeline UI
//  • TWO viseme envelopes (~24/sec) that drive real cartoon lip-sync:
//      - openEnv : low-band (200–1000 Hz) energy → jaw OPEN (a/o/aw)
//      - wideEnv : high-band (1.5–5 kHz) energy → mouth WIDE (e/i/ai)
//    This is a lightweight spectral viseme model — vowels that differ
//    in tongue height produce visibly different cartoon mouth shapes.
// Sprint 7: every generated voice is ALSO persisted in IndexedDB, so
// dialogue plays + exports with zero network (full offline PWA).
// ============================================================

import { loadStoredVoice, storeVoice, voiceKey } from './audio-store';

export interface CachedAudio {
  url: string;
  duration: number;
  /** waveform peaks 0..1, ~24 per second (timeline display) */
  peaks: number[];
  /** combined mouth amplitude 0..1 (legacy — equals openEnv when available) */
  envelope: number[];
  /** jaw-open viseme 0..1 (a/o vowels) — Sprint 5 */
  openEnv: number[];
  /** mouth-widening viseme 0..1 (e/i vowels) — Sprint 5 */
  wideEnv: number[];
}

const cache = new Map<string, CachedAudio>();

export function getCachedAudio(beatId: string): CachedAudio | undefined {
  return cache.get(beatId);
}

export function setCachedAudio(beatId: string, audio: CachedAudio) {
  const prev = cache.get(beatId);
  if (prev?.url) URL.revokeObjectURL(prev.url);
  cache.set(beatId, audio);
}

export function clearCachedAudio(beatId: string) {
  const prev = cache.get(beatId);
  if (prev?.url) URL.revokeObjectURL(prev.url);
  cache.delete(beatId);
}

export function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      resolve(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 3);
    };
    el.onerror = () => resolve(3);
    el.src = url;
  });
}

const FPS = 24;

// ---------------- compact radix-2 FFT (for band energies) ----------------

/** In-place iterative radix-2 FFT. re/im must be power-of-two length. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }
  // butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vrIdx = i + k + len / 2;
        const vr = re[vrIdx] * cr - im[vrIdx] * ci;
        const vi = re[vrIdx] * ci + im[vrIdx] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[vrIdx] = ur - vr;
        im[vrIdx] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

interface BandEnvelopes {
  peaks: number[];
  open: number[];
  wide: number[];
}

/**
 * Spectral viseme analysis: per 24fps frame compute RMS plus the share of
 * energy in the "open vowel" band (200–1000 Hz) vs the "wide vowel" band
 * (1.5–5 kHz). Volume gates both envelopes so the mouth rests when silent.
 */
function spectralBands(
  data: Float32Array,
  sampleRate: number,
): BandEnvelopes {
  const frameLen = Math.max(1, Math.floor(sampleRate / FPS));
  const frames = Math.max(1, Math.floor(data.length / frameLen));
  const N = 1024; // fft size (covers ~23ms at 44.1kHz)
  const hann = new Float32Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const binLo = Math.max(1, Math.floor((200 / sampleRate) * N));
  const binOpenHi = Math.floor((1000 / sampleRate) * N);
  const binWideLo = Math.floor((1500 / sampleRate) * N);
  const binWideHi = Math.min(N / 2 - 1, Math.floor((5000 / sampleRate) * N));

  const re = new Float32Array(N);
  const im = new Float32Array(N);

  const peaks: number[] = new Array(frames);
  const openRaw: number[] = new Array(frames);
  const wideRaw: number[] = new Array(frames);

  for (let f = 0; f < frames; f++) {
    const off = f * frameLen;
    // windowed frame (centered), zero-padded to N
    const start = off - Math.floor((N - frameLen) / 2);
    let rms = 0;
    for (let i = 0; i < N; i++) {
      const v = data[start + i] ?? 0;
      rms += v * v;
      re[i] = v * hann[i];
      im[i] = 0;
    }
    peaks[f] = Math.sqrt(rms / N);

    fft(re, im);
    let total = 0;
    let openE = 0;
    let wideE = 0;
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      total += mag;
      if (k >= binLo && k < binOpenHi) openE += mag;
      if (k >= binWideLo && k <= binWideHi) wideE += mag;
    }
    const safe = total > 1e-6 ? 1 / total : 0;
    openRaw[f] = openE * safe; // 0..~0.8 share of energy
    wideRaw[f] = wideE * safe;
  }

  // normalize peaks
  let maxP = 0;
  for (const p of peaks) if (p > maxP) maxP = p;
  const pNorm = maxP > 0.0001 ? 1 / maxP : 0;
  const peaksN = peaks.map((p) => Math.min(1, p * pNorm));

  // normalize the raw band shares to a lively 0..1 curve, gated by volume
  const normBand = (raw: number[], gamma: number, gain: number): number[] => {
    let m = 0;
    for (const r of raw) if (r > m) m = r;
    const scale = m > 1e-6 ? gain / m : 0;
    return raw.map((r, i) => {
      const vol = Math.min(1, Math.pow(peaksN[i], 0.65)); // volume gate
      const shaped = Math.pow(Math.min(1, r * scale), gamma);
      return Math.min(1, shaped * vol);
    });
  };

  const open = normBand(openRaw, 0.62, 1.0);
  const wide = normBand(wideRaw, 0.7, 1.0);

  return { peaks: peaksN, open, wide };
}

/**
 * Legacy fallback (used when FFT decoding fails): RMS envelope + a
 * believable flap pattern so the mouth still moves.
 */
function syntheticEnvelopes(duration: number): BandEnvelopes {
  const frames = Math.max(8, Math.round(duration * FPS));
  const peaks: number[] = [];
  const open: number[] = [];
  const wide: number[] = [];
  for (let i = 0; i < frames; i++) {
    const v = Math.abs(Math.sin(i * 0.9) * 0.7 + Math.sin(i * 0.23) * 0.3);
    const amp = 0.15 + v * 0.7;
    peaks.push(amp);
    open.push(amp);
    // alternate open/wide vowels every ~5 frames for a lively pattern
    const vowelPhase = Math.sin(i * 0.55);
    wide.push(Math.max(0, amp * (vowelPhase > 0.2 ? 0.85 : 0.15)));
  }
  return { peaks, open, wide };
}

/**
 * Generate Bangla voice for a dialogue line.
 * Order: memory cache → IndexedDB (offline) → /api/tts network call.
 * The result is persisted so it works even when offline later.
 */
export async function generateVoice(
  text: string,
  voice: string,
  speed = 1,
): Promise<CachedAudio> {
  // 1) already in memory?
  // (caller decides — we are keyed by beatId; here we are keyed by content)

  // 2) offline IndexedDB store (same text+voice+speed → instant reuse)
  try {
    const stored = await loadStoredVoice(text, voice, speed);
    if (stored?.blob) {
      const url = URL.createObjectURL(stored.blob);
      return {
        url,
        duration: stored.duration,
        peaks: stored.peaks,
        envelope: stored.openEnv,
        openEnv: stored.openEnv,
        wideEnv: stored.wideEnv,
      };
    }
  } catch {
    /* store miss is fine */
  }

  // 3) network TTS
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, speed }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg?.error ?? `TTS failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  let duration: number;
  let peaks: number[];
  let open: number[];
  let wide: number[];
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) throw new Error('no audio context');
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const bands = spectralBands(buf.getChannelData(0), buf.sampleRate);
    duration = buf.duration;
    peaks = bands.peaks;
    open = bands.open;
    wide = bands.wide;
    ctx.close().catch(() => {});
    if (!(duration > 0.1)) throw new Error('too short');
  } catch {
    duration = await getAudioDuration(url);
    const syn = syntheticEnvelopes(duration);
    peaks = syn.peaks;
    open = syn.open;
    wide = syn.wide;
  }

  // persist for offline reuse (best effort — never blocks the UI)
  try {
    await storeVoice({
      key: voiceKey(text, voice, speed),
      blob,
      duration,
      peaks,
      openEnv: open,
      wideEnv: wide,
      size: blob.size,
      savedAt: Date.now(),
    });
  } catch {
    /* storage full or unavailable — session cache still works */
  }

  return { url, duration, peaks, envelope: open, openEnv: open, wideEnv: wide };
}

/**
 * Sprint 7 — rebuild a CachedAudio for a beat from the offline store.
 * Used when a saved project is reopened and the in-memory cache is cold.
 */
export async function restoreVoiceAudio(
  text: string,
  voice: string,
  speed = 1,
): Promise<CachedAudio | null> {
  try {
    const stored = await loadStoredVoice(text, voice, speed);
    if (!stored?.blob) return null;
    const url = URL.createObjectURL(stored.blob);
    return {
      url,
      duration: stored.duration,
      peaks: stored.peaks,
      envelope: stored.openEnv,
      openEnv: stored.openEnv,
      wideEnv: stored.wideEnv,
    };
  } catch {
    return null;
  }
}
