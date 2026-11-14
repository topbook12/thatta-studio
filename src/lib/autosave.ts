// ============================================================
// ঠাট্টা স্টুডিও — Auto-save + crash recovery (Phase 1, Day 1–10)
//
// The zustand persist key (`thatta-studio-v1`) always holds the live
// working state. This module keeps TWO rotating backup slots so a
// corrupted/half-written persist write (tab killed mid-write) can
// never destroy the user's work:
//
//   thatta.autosave.a / thatta.autosave.b  — alternating snapshots,
//     each write goes to the OTHER slot, so the previous good
//     snapshot always survives a crash during a write.
//
// Crash detection: `thatta.session` is set to "open" on every app
// start and removed on a clean exit (pagehide). If a new session
// finds it still "open", the previous session died without cleanup
// (crash / killed tab / battery pull) → offer the backup.
// ============================================================

import type { CharacterDesign, Scene } from "./cartoon/types";

const SLOT_A = "thatta.autosave.a";
const SLOT_B = "thatta.autosave.b";
const SESSION_KEY = "thatta.session";

/** How long edits wait before hitting the backup slots. */
export const AUTOSAVE_DEBOUNCE_MS = 3000;

export interface AutosavePayload {
  designs: CharacterDesign[];
  scene: Scene;
  savedAt: number;
}

interface StoredSlot extends AutosavePayload {
  slot: "a" | "b";
}

// ---------- validation ----------

/** Shape-check a parsed slot so corrupted JSON can never enter the store. */
function isValidSlot(value: unknown): value is StoredSlot {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<StoredSlot>;
  if (!Array.isArray(p.designs) || typeof p.savedAt !== "number") return false;
  const sc = p.scene as Scene | undefined;
  return (
    !!sc &&
    Array.isArray(sc.beats) &&
    Array.isArray(sc.characters) &&
    typeof sc.background === "string"
  );
}

// ---------- slot helpers ----------

function readSlot(key: string): StoredSlot | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSlot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSlot(key: string, data: StoredSlot): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    // quota full / private mode — autosave must never crash the app
    return false;
  }
}

/** which slot currently holds the NEWEST snapshot (lazy, client only) */
let activeSlot: "a" | "b" | null = null;

function resolveActiveSlot(): "a" | "b" {
  if (activeSlot) return activeSlot;
  const a = readSlot(SLOT_A);
  const b = readSlot(SLOT_B);
  activeSlot = !a ? "b" : !b ? "a" : a.savedAt >= b.savedAt ? "a" : "b";
  return activeSlot;
}

// ---------- write path ----------

/** Write a snapshot immediately. Returns savedAt, or null on failure. */
export function flushAutosave(
  designs: CharacterDesign[],
  scene: Scene,
): number | null {
  if (typeof window === "undefined") return null;
  const cur = resolveActiveSlot();
  const target: "a" | "b" = cur === "a" ? "b" : "a"; // rotate → previous stays safe
  const payload: StoredSlot = { designs, scene, savedAt: Date.now(), slot: target };
  const ok = writeSlot(target === "a" ? SLOT_A : SLOT_B, payload);
  if (ok) activeSlot = target;
  return ok ? payload.savedAt : null;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced (3 s) backup — call on every studio change. */
export function scheduleAutosave(
  designs: CharacterDesign[],
  scene: Scene,
  onSaved?: (savedAt: number) => void,
): void {
  if (typeof window === "undefined") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const at = flushAutosave(designs, scene);
    if (at && onSaved) onSaved(at);
  }, AUTOSAVE_DEBOUNCE_MS);
}

/** Cancel a pending debounced write (unmount). */
export function cancelScheduledAutosave(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

// ---------- read path ----------

/** Newest valid backup across both slots (null when none). */
export function readLatestAutosave(): AutosavePayload | null {
  if (typeof window === "undefined") return null;
  const a = readSlot(SLOT_A);
  const b = readSlot(SLOT_B);
  if (a && b) return a.savedAt >= b.savedAt ? a : b;
  return a ?? b;
}

/** Wipe both backup slots (used by "start fresh" recovery). */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(SLOT_A);
    localStorage.removeItem(SLOT_B);
  } catch {
    /* ignore */
  }
}

// ---------- session / crash flag ----------

/** Mark the session as running (called once on studio mount). */
export function markSessionOpen(): void {
  try {
    localStorage.setItem(SESSION_KEY, "open");
  } catch {
    /* ignore */
  }
}

/** Remove the flag on a clean exit — absence means "no crash last time". */
export function markSessionClean(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the previous session ended without cleanup. */
export function wasUncleanExit(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "open";
  } catch {
    return false;
  }
}

// ---------- restore ----------

/**
 * Copy the newest backup into the zustand persist key and reload.
 * The persist format is `{ state: { designs, scene }, version: 0 }`.
 */
export function restoreAutosaveIntoStore(): boolean {
  const backup = readLatestAutosave();
  if (!backup) return false;
  try {
    localStorage.setItem(
      "thatta-studio-v1",
      JSON.stringify({
        state: { designs: backup.designs, scene: backup.scene },
        version: 0,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
