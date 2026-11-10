// ============================================================
// ঠাট্টা স্টুডিও — TTS audio cache + lip-sync analysis
// Each generated voice line is decoded once; we keep:
//  • duration (accurate, from decoded PCM)
//  • waveform peaks (~24/sec) for the timeline UI
//  • amplitude envelope (~24/sec) that drives real lip-sync
// ============================================================

export interface CachedAudio {
  url: string;
  duration: number;
  /** waveform peaks 0..1, ~24 per second (timeline display) */
  peaks: number[];
  /** mouth amplitude 0..1, ~24 per second (lip-sync) */
  envelope: number[];
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

/**
 * Decode audio and compute duration + per-frame RMS envelope.
 * Returns null when the browser cannot decode the blob.
 */
async function analyzeBlob(blob: Blob): Promise<{
  duration: number;
  peaks: number[];
  envelope: number[];
} | null> {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const frameLen = Math.max(1, Math.floor(buf.sampleRate / FPS));
    const frames = Math.max(1, Math.floor(data.length / frameLen));

    const raw: number[] = new Array(frames);
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      const off = f * frameLen;
      for (let i = 0; i < frameLen; i++) {
        const v = data[off + i] ?? 0;
        sum += v * v;
      }
      raw[f] = Math.sqrt(sum / frameLen);
    }

    let max = 0;
    for (const r of raw) if (r > max) max = r;
    const norm = max > 0.0001 ? 1 / max : 0;

    const peaks = raw.map((r) => Math.min(1, r * norm));
    // gentle gamma so quiet syllables still move the mouth a bit
    const envelope = peaks.map((p) => Math.min(1, Math.pow(p, 0.72)));

    const duration = buf.duration;
    ctx.close().catch(() => {});
    return { duration, peaks, envelope };
  } catch {
    return null;
  }
}

/** Fallback envelope when decoding fails — a believable flap pattern. */
function syntheticEnvelope(duration: number): { peaks: number[]; envelope: number[] } {
  const frames = Math.max(8, Math.round(duration * FPS));
  const peaks: number[] = [];
  for (let i = 0; i < frames; i++) {
    const v = Math.abs(Math.sin(i * 0.9) * 0.7 + Math.sin(i * 0.23) * 0.3);
    peaks.push(0.15 + v * 0.7);
  }
  return { peaks, envelope: peaks };
}

/** Generate Bangla voice for a dialogue line via /api/tts (with lip-sync analysis). */
export async function generateVoice(
  text: string,
  voice: string,
): Promise<CachedAudio> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg?.error ?? `TTS failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const analysis = await analyzeBlob(blob);
  let duration: number;
  let peaks: number[];
  let envelope: number[];
  if (analysis && analysis.duration > 0.1) {
    duration = analysis.duration;
    peaks = analysis.peaks;
    envelope = analysis.envelope;
  } else {
    duration = await getAudioDuration(url);
    const syn = syntheticEnvelope(duration);
    peaks = syn.peaks;
    envelope = syn.envelope;
  }

  return { url, duration, peaks, envelope };
}
