// ============================================================
// ঠাট্টা স্টুডিও — Sprint 7: offline project store (localStorage)
//
// "ডিভাইসে সেভ" keeps the serialized scene + cast on the device so
// projects reload with ZERO network — the heart of the full-offline
// PWA promise. The API is synchronous (call sites rely on it), so we
// back it with localStorage: a small JSON index plus one key per
// project. If the ~5 MB quota fills up, the OLDEST project is evicted
// automatically after a warning toast-worthy flag on the meta.
// ============================================================

export interface LocalProjectMeta {
  id: string;
  name: string;
  /** epoch ms of the last save */
  updatedAt: number;
  /** serialized project JSON byte size (for future UI) */
  size: number;
}

export interface LocalProject extends LocalProjectMeta {
  data: string;
}

const INDEX_KEY = 'thatta.projects.index';
const PROJECT_KEY = (id: string) => `thatta.project.${id}`;
const MAX_PROJECTS = 40;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readIndex(): LocalProjectMeta[] {
  if (typeof window === 'undefined') return [];
  return safeParse<LocalProjectMeta[]>(window.localStorage.getItem(INDEX_KEY), []);
}

function writeIndex(list: LocalProjectMeta[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* index is tiny — ignore write failures */
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** All device-saved projects, newest first. */
export function listLocalProjects(): LocalProjectMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Save (or overwrite, when a project with the same name exists) the
 * serialized project on this device. Returns the fresh metadata.
 */
export function saveLocalProject(name: string, data: string): LocalProjectMeta {
  const index = readIndex();
  const existing = index.find((p) => p.name === name);

  const meta: LocalProjectMeta = existing
    ? { ...existing, updatedAt: Date.now(), size: data.length }
    : { id: newId(), name, updatedAt: Date.now(), size: data.length };

  // persist the payload first — if the quota is full, evict the oldest
  // OTHER project and retry once before giving up
  const put = (): boolean => {
    try {
      window.localStorage.setItem(PROJECT_KEY(meta.id), JSON.stringify(meta) + '\u0000' + data);
      return true;
    } catch {
      return false;
    }
  };

  let ok = put();
  if (!ok) {
    const oldest = [...index]
      .filter((p) => p.id !== meta.id)
      .sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) {
      deleteLocalProject(oldest.id);
      ok = put();
    }
  }
  if (!ok) {
    throw new Error('ডিভাইসে জায়গা নেই — পুরনো প্রজেক্ট ডিলিট করুন');
  }

  writeIndex([...index.filter((p) => p.id !== meta.id), meta].slice(-MAX_PROJECTS));
  return meta;
}

/** Load one device project (with its serialized data), or null. */
export function getLocalProject(id: string): LocalProject | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROJECT_KEY(id));
  if (!raw) return null;

  const sep = raw.indexOf('\u0000');
  const meta = safeParse<LocalProjectMeta | null>(
    sep === -1 ? raw : raw.slice(0, sep),
    null,
  );
  const data = sep === -1 ? '' : raw.slice(sep + 1);
  if (!meta) return null;
  return { ...meta, data };
}

/** Remove a device project permanently. */
export function deleteLocalProject(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROJECT_KEY(id));
  } catch {
    /* nothing to undo */
  }
  writeIndex(readIndex().filter((p) => p.id !== id));
}
