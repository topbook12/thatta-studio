// ============================================================
// ঠাট্টা স্টুডিও — Sprint 7: offline voice store (IndexedDB)
//
// Every generated TTS line is persisted in IndexedDB keyed by
// voice|speed|text-hash, so previously generated dialogue plays
// and exports even with ZERO network (true PWA offline).
// A soft cap (~48 MB) evicts the oldest lines first.
// ============================================================

export interface StoredVoice {
  key: string;
  blob: Blob;
  duration: number;
  peaks: number[];
  openEnv: number[];
  wideEnv: number[];
  size: number;
  savedAt: number;
}

const DB_NAME = 'thatta-audio';
const STORE = 'voices';
const DB_VERSION = 1;
const MAX_BYTES = 48 * 1024 * 1024; // ~48 MB voice budget
const MAX_COUNT = 120;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('savedAt', 'savedAt');
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

/** Compact, collision-resistant-enough key: voice|speed|hash|len */
export function voiceKey(text: string, voice: string, speed: number): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return `${voice}|${speed}|${(h >>> 0).toString(36)}|${text.length}`;
}

export async function loadStoredVoice(
  text: string,
  voice: string,
  speed: number,
): Promise<StoredVoice | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(voiceKey(text, voice, speed));
      req.onsuccess = () => resolve((req.result as StoredVoice | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function storeVoice(entry: StoredVoice): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  await evictOldVoices(db);
}

/** keep the store inside its budget — oldest lines go first */
async function evictOldVoices(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result ?? []) as StoredVoice[];
        let totalBytes = all.reduce((s, v) => s + (v.size || 0), 0);
        const sorted = [...all].sort((a, b) => a.savedAt - b.savedAt);
        while (sorted.length > 0 && (totalBytes > MAX_BYTES || sorted.length > MAX_COUNT)) {
          const oldest = sorted.shift();
          if (!oldest) break;
          store.delete(oldest.key);
          totalBytes -= oldest.size || 0;
        }
        resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function voiceStoreUsage(): Promise<{ bytes: number; count: number }> {
  const db = await openDb();
  if (!db) return { bytes: 0, count: 0 };
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result ?? []) as StoredVoice[];
        resolve({
          bytes: all.reduce((s, v) => s + (v.size || 0), 0),
          count: all.length,
        });
      };
      req.onerror = () => resolve({ bytes: 0, count: 0 });
    } catch {
      resolve({ bytes: 0, count: 0 });
    }
  });
}
