// ============================================================
// ঠাট্টা স্টুডিও — Client-side TTS audio cache (module singleton)
// ============================================================

export interface CachedAudio {
  url: string;
  duration: number;
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

/** Generate Bangla voice for a dialogue line via /api/tts. */
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
  const duration = await getAudioDuration(url);
  return { url, duration };
}
