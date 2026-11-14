// ============================================================
// ঠাট্টা স্টুডিও — Global studio state (zustand + localStorage persist)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  newId,
  normalizeScene,
  presetCast,
  starterScene,
} from './cartoon/presets';
import { history } from './history';
import type {
  BgName,
  CameraShot,
  CharacterDesign,
  PlacedCharacter,
  Scene,
  SceneBeat,
} from './cartoon/types';

const initialCast = presetCast();
const initialScene = normalizeScene(starterScene(initialCast));

export interface StudioState {
  designs: CharacterDesign[];
  scene: Scene;

  addDesign: (d: CharacterDesign) => void;
  updateDesign: (id: string, patch: Partial<CharacterDesign>) => void;
  deleteDesign: (id: string) => void;
  setDesigns: (list: CharacterDesign[]) => void;

  setBackground: (bg: BgName) => void;
  addPlaced: (designId: string) => void;
  updatePlaced: (uid: string, patch: Partial<PlacedCharacter>) => void;
  removePlaced: (uid: string) => void;

  addBeat: (beat: Omit<SceneBeat, 'id'>) => void;
  updateBeat: (id: string, patch: Partial<SceneBeat>) => void;
  removeBeat: (id: string) => void;
  moveBeat: (id: string, dir: -1 | 1) => void;
  /** re-time a beat on the absolute timeline (and optionally reassign actor) */
  moveBeatTo: (id: string, start: number, actorUid?: string) => void;
  setScene: (s: Scene) => void;
  clearBeats: () => void;

  // Sprint 6 — cinematic camera
  addCameraShot: (shot: Omit<CameraShot, 'id'>) => void;
  updateCameraShot: (id: string, patch: Partial<CameraShot>) => void;
  removeCameraShot: (id: string) => void;
  setCameraShake: (on: boolean) => void;

  // Sprint 8 — undo/redo (injected by the history middleware)
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const useStudio = create<StudioState>()(
  history(
    persist(
      (set, get) => ({
      designs: initialCast,
      scene: initialScene,

      addDesign: (d) => set((s) => ({ designs: [...s.designs, d] })),
      updateDesign: (id, patch) =>
        set((s) => ({
          designs: s.designs.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      deleteDesign: (id) =>
        set((s) => {
          // also remove placed instances and beats referencing it
          const affectedUids = new Set(
            s.scene.characters.filter((c) => c.designId === id).map((c) => c.uid),
          );
          return {
            designs: s.designs.filter((x) => x.id !== id),
            scene: {
              ...s.scene,
              characters: s.scene.characters.filter((c) => c.designId !== id),
              beats: s.scene.beats.filter((b) => !affectedUids.has(b.actorUid)),
            },
          };
        }),
      setDesigns: (list) => set({ designs: list }),

      setBackground: (bg) => set((s) => ({ scene: { ...s.scene, background: bg } })),
      addPlaced: (designId) =>
        set((s) => {
          const count = s.scene.characters.length;
          const x = count === 0 ? 30 : Math.min(85, 20 + count * 18);
          const placed: PlacedCharacter = {
            uid: newId(),
            designId,
            x,
            scale: 1.1 + (count % 3) * 0.12,
            flip: false,
          };
          return { scene: { ...s.scene, characters: [...s.scene.characters, placed] } };
        }),
      updatePlaced: (uid, patch) =>
        set((s) => ({
          scene: {
            ...s.scene,
            characters: s.scene.characters.map((c) =>
              c.uid === uid ? { ...c, ...patch } : c,
            ),
          },
        })),
      removePlaced: (uid) =>
        set((s) => ({
          scene: {
            ...s.scene,
            characters: s.scene.characters.filter((c) => c.uid !== uid),
            beats: s.scene.beats.filter((b) => b.actorUid !== uid),
          },
        })),

      addBeat: (beat) =>
        set((s) => {
          // default: place at the end of this actor's own track (parallel-safe)
          let start = beat.start;
          if (typeof start !== 'number' || start < 0) {
            start = 0;
            for (const b of s.scene.beats) {
              if (b.actorUid !== beat.actorUid) continue;
              const end = (b.start ?? 0) + Math.max(0.3, b.duration);
              start = Math.max(start, end);
            }
          }
          return {
            scene: {
              ...s.scene,
              beats: [
                ...s.scene.beats,
                { ...beat, start: Math.round(start * 20) / 20, id: newId() },
              ],
            },
          };
        }),
      updateBeat: (id, patch) =>
        set((s) => ({
          scene: {
            ...s.scene,
            beats: s.scene.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          },
        })),
      removeBeat: (id) =>
        set((s) => ({
          scene: { ...s.scene, beats: s.scene.beats.filter((b) => b.id !== id) },
        })),
      moveBeat: (id, dir) =>
        set((s) => {
          const beats = [...s.scene.beats];
          const i = beats.findIndex((b) => b.id === id);
          if (i < 0) return {};
          const j = i + dir;
          if (j < 0 || j >= beats.length) return {};
          [beats[i], beats[j]] = [beats[j], beats[i]];
          return { scene: { ...s.scene, beats } };
        }),
      moveBeatTo: (id, start, actorUid) =>
        set((s) => ({
          scene: {
            ...s.scene,
            beats: s.scene.beats.map((b) =>
              b.id === id
                ? {
                    ...b,
                    start: Math.max(0, Math.round(start * 20) / 20),
                    ...(actorUid ? { actorUid } : {}),
                  }
                : b,
            ),
          },
        })),
      setScene: (sc) => set({ scene: normalizeScene(sc) }),
      clearBeats: () => set((s) => ({ scene: { ...s.scene, beats: [] } })),

      // Sprint 6 — cinematic camera
      addCameraShot: (shot) =>
        set((s) => ({
          scene: {
            ...s.scene,
            camera: {
              shots: [
                ...(s.scene.camera?.shots ?? []),
                { ...shot, id: newId() },
              ],
              shake: s.scene.camera?.shake,
            },
          },
        })),
      updateCameraShot: (id, patch) =>
        set((s) => ({
          scene: {
            ...s.scene,
            camera: {
              shots: (s.scene.camera?.shots ?? []).map((x) =>
                x.id === id ? { ...x, ...patch } : x,
              ),
              shake: s.scene.camera?.shake,
            },
          },
        })),
      removeCameraShot: (id) =>
        set((s) => ({
          scene: {
            ...s.scene,
            camera: {
              shots: (s.scene.camera?.shots ?? []).filter((x) => x.id !== id),
              shake: s.scene.camera?.shake,
            },
          },
        })),
      setCameraShake: (on) =>
        set((s) => ({
          scene: {
            ...s.scene,
            camera: {
              shots: s.scene.camera?.shots ?? [],
              shake: on,
            },
          },
        })),

      // Sprint 8 — real implementations are injected by history()
      undo: () => {},
      redo: () => {},
      canUndo: false,
      canRedo: false,
    }),
    {
      name: 'thatta-studio-v1',
      // history helpers must not be persisted — only creative content is
      partialize: (s) => ({ designs: s.designs, scene: s.scene }),
      /**
       * Normalize + sanitize on load. merge() (not onRehydrateStorage!)
       * because the callback form runs during create() where referencing
       * this store throws a swallowed TDZ error that silently kills
       * hydration (found during Phase 1 browser verification).
       * Also guards corrupted shapes: a non-array designs / non-object
       * scene falls back to the in-code defaults instead of crashing.
       */
      merge: (persisted, current) => {
        const p = persisted as Partial<StudioState> | undefined;
        return {
          ...current,
          designs: Array.isArray(p?.designs)
            ? (p.designs as CharacterDesign[])
            : current.designs,
          scene: p?.scene ? normalizeScene(p.scene as Scene) : current.scene,
        };
      },
    },
    ),
  ),
);

/** Resolve the design for a placed character. */
export function designOf(
  placed: PlacedCharacter | undefined,
  designs: CharacterDesign[],
): CharacterDesign | undefined {
  if (!placed) return undefined;
  return designs.find((d) => d.id === placed.designId);
}
