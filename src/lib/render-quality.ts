// ============================================================
// ঠাট্টা স্টুডিও — Phase 8: রেন্ডার কোয়ালিটি মোড
// Auto / High / Battery — controls canvas supersampling scale,
// ambient particle density and (indirectly) battery drain.
//
// Persisted in localStorage; `auto` resolves from device signals
// (CPU cores / device memory) once per session and re-evaluates
// when nothing forces otherwise. All getters are pure functions
// so the render pipeline (backgrounds, engine, exporter) can call
// them frame-to-frame with zero React involvement.
// ============================================================

export type QualityMode = 'auto' | 'high' | 'battery';
/** what `auto` resolves to — the pipeline only ever sees these two */
export type ResolvedQuality = 'high' | 'battery';

const KEY = 'thatta.render-quality';

const listeners = new Set<() => void>();

function readStored(): QualityMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(KEY);
    return v === 'high' || v === 'battery' || v === 'auto' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let mode: QualityMode = 'auto';
let resolvedCache: ResolvedQuality | null = null;

/** device capability heuristic — low-end phones get the light path */
function detectLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem != null && mem <= 2) return true;
  return cores <= 2;
}

/**
 * Resolved quality for THIS device under the current mode.
 * Cached per session; `setQualityMode` clears the cache.
 */
export function resolveQuality(): ResolvedQuality {
  if (resolvedCache) return resolvedCache;
  const m = mode === 'auto' ? readStored() : mode;
  resolvedCache = m === 'battery' || (m === 'auto' && detectLowEnd())
    ? 'battery'
    : 'high';
  return resolvedCache;
}

export function getQualityMode(): QualityMode {
  mode = readStored();
  return mode;
}

export function setQualityMode(next: QualityMode) {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — session-only */
  }
  resolvedCache = null;
  for (const l of listeners) l();
}

/** subscribe to quality changes (React: useSyncExternalStore) */
export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Background canvas supersampling factor.
 * high → 2× (razor sharp on HiDPI + 1080p exports)
 * battery → 1.25× (≈2.6× fewer pixels to paint & hold)
 */
export function bgScale(): number {
  return resolveQuality() === 'high' ? 2 : 1.25;
}

/**
 * Ambient-particle density multiplier (clouds, birds, stars, fireflies,
 * rain streaks, dust…). battery → ~half the particles, same visuals.
 */
export function ambientDensity(): number {
  return resolveQuality() === 'high' ? 1 : 0.45;
}

/** scale a decorative loop count by the current density (min 1) */
export function densityCount(base: number): number {
  return Math.max(1, Math.round(base * ambientDensity()));
}

/** Bangla label for the mode chips */
export function qualityLabel(m: QualityMode): string {
  if (m === 'high') return 'উচ্চ মান';
  if (m === 'battery') return 'ব্যাটারি সেভ';
  return 'অটো';
}
