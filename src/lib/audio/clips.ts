// ============================================================
// ঠাট্টা স্টুডিও — Phase 4 (সাউন্ড স্টুডিও): নিজের গলা রেকর্ড
//
// MediaRecorder capture → noise cleanup → IndexedDB persistence.
// Cleanup pipeline (all offline):
//   1. high-pass 85 Hz (rumble/hand-hum removal)
//   2. soft spectral-gate from the ESTIMATED noise floor
//      (quietest-percentile window RMS) with attack/release smoothing
//   3. peak-normalize to −1 dB
// A clip is keyed by the BEAT id it belongs to, so reopening a
// project restores your own voice exactly like the TTS cache does.
// ============================================================

import { encodeWav } from "./wav";

interface StoredClip {
  beatId: string;
  blob: Blob;
  duration: number;
  size: number;
  savedAt: number;
}

const DB_NAME = "thatta-clips";
const STORE = "clips";
const MAX_BYTES = 24 * 1024 * 1024; // ~24 MB of recordings
const MAX_COUNT = 80;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "beatId" });
          store.createIndex("savedAt", "savedAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function saveClip(beatId: string, blob: Blob, duration: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        beatId,
        blob,
        duration,
        size: blob.size,
        savedAt: Date.now(),
      } satisfies StoredClip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  await evictOldClips(db);
}

async function evictOldClips(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result ?? []) as StoredClip[];
        let total = all.reduce((s, c) => s + (c.size || 0), 0);
        const sorted = [...all].sort((a, b) => a.savedAt - b.savedAt);
        while (sorted.length > 0 && (total > MAX_BYTES || sorted.length > MAX_COUNT)) {
          const oldest = sorted.shift();
          if (!oldest) break;
          store.delete(oldest.beatId);
          total -= oldest.size || 0;
        }
        resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadClip(beatId: string): Promise<StoredClip | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(beatId);
      req.onsuccess = () => resolve((req.result as StoredClip | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteClip(beatId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(beatId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------- decode + cleanup ----------------

async function decode(blob: Blob): Promise<AudioBuffer | null> {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close().catch(() => {});
    return buf;
  } catch {
    return null;
  }
}

/**
 * Full cleanup chain. Returns a WAV blob ready for playback/export
 * plus the final duration. Throws when the browser cannot decode.
 */
export async function cleanUpRecording(blob: Blob): Promise<{ blob: Blob; duration: number }> {
  const decoded = await decode(blob);
  if (!decoded) throw new Error("রেকর্ডিং ডিকোড করা যায়নি");

  const mono = decoded.numberOfChannels > 1 ? mixdown(decoded) : decoded.getChannelData(0);
  const sr = decoded.sampleRate;

  // 1) rumble removal — simple high-pass on PCM (biquad-free, stable)
  const hp = highPass(mono, 85, sr);

  // 2) soft noise gate from estimated floor
  const gated = softGate(hp, sr);

  // 3) peak normalize to ~0.89 (−1 dB)
  let peak = 0.0001;
  for (let i = 0; i < gated.length; i++) {
    const v = Math.abs(gated[i]);
    if (v > peak) peak = v;
  }
  const scale = 0.89 / peak;
  if (scale < 1 || scale > 1.6) {
    for (let i = 0; i < gated.length; i++) gated[i] *= scale;
  }

  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OAC(1, gated.length, sr);
  const out = ctx.createBuffer(1, gated.length, sr);
  out.copyToChannel(gated as Float32Array<ArrayBuffer>, 0);
  const duration = out.duration;
  return { blob: encodeWav(out), duration };
}

function mixdown(buf: AudioBuffer): Float32Array {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

/** One-pole high-pass: y[n] = a * (y[n−1] + x[n] − x[n−1]). */
function highPass(input: Float32Array, hz: number, sr: number): Float32Array {
  const rc = 1 / (2 * Math.PI * hz);
  const dt = 1 / sr;
  const a = rc / (rc + dt);
  const out = new Float32Array(input.length);
  let prevIn = input[0] ?? 0;
  let prevOut = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    prevOut = a * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut;
  }
  return out;
}

/**
 * Soft noise gate: 1024-sample windows; floor = 10th-percentile RMS;
 * per-window gain eased between 0.06 and 1 with attack/release ramps
 * so words never click at the boundary.
 */
function softGate(input: Float32Array, sr: number): Float32Array {
  const W = 1024;
  const frames = Math.max(1, Math.ceil(input.length / W));
  const rms = new Array<number>(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const off = f * W;
    for (let i = 0; i < W; i++) {
      const v = input[off + i] ?? 0;
      s += v * v;
    }
    rms[f] = Math.sqrt(s / W);
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.max(0, Math.floor(sorted.length * 0.1))] ?? 0;
  const openAt = floor * 1.8 + 0.006; // above this → fully open
  const closedAt = floor * 1.05 + 0.002; // below this → closed

  const gain = new Array<number>(frames);
  for (let f = 0; f < frames; f++) {
    const r = rms[f];
    let g: number;
    if (r >= openAt) g = 1;
    else if (r <= closedAt) g = 0.06;
    else g = 0.06 + ((r - closedAt) / (openAt - closedAt)) * 0.94;
    // smooth with previous frame (attack ≈ release ≈ 1 window)
    const prev = f > 0 ? gain[f - 1] : 0.06;
    gain[f] = prev + (g - prev) * 0.4;
  }

  const out = new Float32Array(input.length);
  for (let f = 0; f < frames; f++) {
    const g = gain[f];
    for (let i = 0; i < W; i++) {
      const idx = f * W + i;
      if (idx >= out.length) break;
      out[idx] = input[idx] * g;
    }
  }
  return out;
}
