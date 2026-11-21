// ============================================================
// ঠাট্টা স্টুডিও — Global studio state (zustand + localStorage persist)
//
// Phase 2 — মাল্টি-সিন এপিসোড: the store now holds a LIST of named
// scenes (`scenes`) plus the id of the scene being edited
// (`activeSceneId`). Every legacy scene action (addBeat, addPlaced…)
// writes through to the ACTIVE scene only. Old persisted projects
// ({ designs, scene }) migrate into a one-scene episode on load.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  cloneEpisodeScene,
  freshEpisodeScene,
  newId,
  nextSceneName,
  normalizeScene,
  presetCast,
  starterScene,
} from './cartoon/presets';
import { history } from './history';
import type {
  BgName,
  CameraShot,
  CharacterDesign,
  DecorName,
  EpisodeScene,
  PlacedCharacter,
  Scene,
  SceneBeat,
  SceneEnvironment,
  SceneSfxEvent,
  SceneTransition,
} from './cartoon/types';

const initialCast = presetCast();
const initialScene = normalizeScene(starterScene(initialCast));
const initialEpisode: EpisodeScene = {
  id: newId(),
  name: 'দৃশ্য ১',
  scene: initialScene,
};

export interface StudioState {
  designs: CharacterDesign[];
  /** all scenes of the current episode, in play order */
  scenes: EpisodeScene[];
  /** which scene the stage/timeline is editing */
  activeSceneId: string;

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
  /** replace the ACTIVE scene's content (templates, single-scene loads) */
  setActiveScene: (s: Scene) => void;
  clearBeats: () => void;

  // ---- Phase 2 — episode (multi-scene) management ----
  setActiveSceneId: (id: string) => void;
  /** new empty scene AFTER the active one (same bg + cast), becomes active */
  addScene: () => void;
  /** full copy with regenerated ids, placed right after the original */
  duplicateScene: (id: string) => void;
  /** remove a scene (never the last one); activate the next neighbour */
  deleteScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  moveScene: (id: string, dir: -1 | 1) => void;
  /** outgoing transition of a scene into the next one */
  setSceneTransition: (id: string, t: SceneTransition) => void;
  /** whole-project load (device/cloud/backup); optional saved active id */
  loadEpisodes: (
    scenes: EpisodeScene[],
    designs: CharacterDesign[],
    activeId?: string,
  ) => void;

  // Sprint 6 — cinematic camera
  addCameraShot: (shot: Omit<CameraShot, 'id'>) => void;
  updateCameraShot: (id: string, patch: Partial<CameraShot>) => void;
  removeCameraShot: (id: string) => void;
  setCameraShake: (on: boolean) => void;

  // ---- Phase 4 — সাউন্ড স্টুডিও ----
  /** pick (or drop with 'none') the active scene's background music */
  setSceneMusic: (trackId: string | null, volume?: number) => void;
  /** adjust only the music loudness of the active scene */
  setSceneMusicVolume: (volume: number) => void;
  /** replace the active scene's whole SFX event list */
  setSfxEvents: (events: SceneSfxEvent[]) => void;

  // ---- Phase 5 — জগৎ তৈরি (world building) ----
  /** patch the active scene's environment (time-of-day / weather / warmth) */
  setSceneEnvironment: (patch: Partial<SceneEnvironment>) => void;
  /** add a decor piece at a default spot; becomes the most-recent layer */
  addDecor: (decorId: DecorName) => void;
  updateDecor: (uid: string, patch: Partial<{ x: number; scale: number; z: number }>) => void;
  removeDecor: (uid: string) => void;

  // Sprint 8 — undo/redo (injected by the history middleware)
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Map over the ACTIVE scene only (the episode keeps everything else). */
function withActive(
  s: { scenes: EpisodeScene[]; activeSceneId: string },
  fn: (scene: Scene) => Scene,
): Pick<StudioState, 'scenes'> {
  return {
    scenes: s.scenes.map((es) =>
      es.id === s.activeSceneId ? { ...es, scene: fn(es.scene) } : es,
    ),
  };
}

export const useStudio = create<StudioState>()(
  history(
    persist(
      (set) => ({
      designs: initialCast,
      scenes: [initialEpisode],
      activeSceneId: initialEpisode.id,

      addDesign: (d) => set((s) => ({ designs: [...s.designs, d] })),
      updateDesign: (id, patch) =>
        set((s) => ({
          designs: s.designs.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      deleteDesign: (id) =>
        set((s) => {
          // also remove placed instances and beats referencing it — in EVERY
          // scene of the episode (a cast member acts across the whole story)
          return {
            designs: s.designs.filter((x) => x.id !== id),
            scenes: s.scenes.map((es) => {
              const affectedUids = new Set(
                es.scene.characters
                  .filter((c) => c.designId === id)
                  .map((c) => c.uid),
              );
              return {
                ...es,
                scene: {
                  ...es.scene,
                  characters: es.scene.characters.filter((c) => c.designId !== id),
                  beats: es.scene.beats.filter((b) => !affectedUids.has(b.actorUid)),
                },
              };
            }),
          };
        }),
      setDesigns: (list) => set({ designs: list }),

      setBackground: (bg) =>
        set((s) => withActive(s, (sc) => ({ ...sc, background: bg }))),
      addPlaced: (designId) =>
        set((s) =>
          withActive(s, (sc) => {
            const count = sc.characters.length;
            const x = count === 0 ? 30 : Math.min(85, 20 + count * 18);
            const placed: PlacedCharacter = {
              uid: newId(),
              designId,
              x,
              scale: 1.1 + (count % 3) * 0.12,
              flip: false,
            };
            return { ...sc, characters: [...sc.characters, placed] };
          }),
        ),
      updatePlaced: (uid, patch) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            characters: sc.characters.map((c) =>
              c.uid === uid ? { ...c, ...patch } : c,
            ),
          })),
        ),
      removePlaced: (uid) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            characters: sc.characters.filter((c) => c.uid !== uid),
            beats: sc.beats.filter((b) => b.actorUid !== uid),
          })),
        ),

      addBeat: (beat) =>
        set((s) =>
          withActive(s, (sc) => {
            // default: place at the end of this actor's own track (parallel-safe)
            let start = beat.start;
            if (typeof start !== 'number' || start < 0) {
              start = 0;
              for (const b of sc.beats) {
                if (b.actorUid !== beat.actorUid) continue;
                const end = (b.start ?? 0) + Math.max(0.3, b.duration);
                start = Math.max(start, end);
              }
            }
            return {
              ...sc,
              beats: [
                ...sc.beats,
                { ...beat, start: Math.round(start * 20) / 20, id: newId() },
              ],
            };
          }),
        ),
      updateBeat: (id, patch) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            beats: sc.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          })),
        ),
      removeBeat: (id) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            beats: sc.beats.filter((b) => b.id !== id),
          })),
        ),
      moveBeat: (id, dir) =>
        set((s) =>
          withActive(s, (sc) => {
            const beats = [...sc.beats];
            const i = beats.findIndex((b) => b.id === id);
            if (i < 0) return sc;
            const j = i + dir;
            if (j < 0 || j >= beats.length) return sc;
            [beats[i], beats[j]] = [beats[j], beats[i]];
            return { ...sc, beats };
          }),
        ),
      moveBeatTo: (id, start, actorUid) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            beats: sc.beats.map((b) =>
              b.id === id
                ? {
                    ...b,
                    start: Math.max(0, Math.round(start * 20) / 20),
                    ...(actorUid ? { actorUid } : {}),
                  }
                : b,
            ),
          })),
        ),
      setActiveScene: (sc) =>
        set((s) => withActive(s, () => normalizeScene(sc))),
      clearBeats: () =>
        set((s) => withActive(s, (sc) => ({ ...sc, beats: [] }))),

      // ---- Phase 2 — episode management ----
      setActiveSceneId: (id) =>
        set((s) =>
          s.scenes.some((es) => es.id === id) ? { activeSceneId: id } : {},
        ),
      addScene: () =>
        set((s) => {
          if (s.scenes.length >= 12) return {}; // sanity cap (mirrors the UI)
          const src = s.scenes.find((es) => es.id === s.activeSceneId);
          const created = freshEpisodeScene(nextSceneName(s.scenes), src?.scene);
          const at = s.scenes.findIndex((es) => es.id === s.activeSceneId);
          const scenes = [...s.scenes];
          scenes.splice(at + 1, 0, created);
          return { scenes, activeSceneId: created.id };
        }),
      duplicateScene: (id) =>
        set((s) => {
          const src = s.scenes.find((es) => es.id === id);
          if (!src) return {};
          const base = src.name.replace(/\s*\(কপি\)\s*\d*$/, '').trim();
          // unique copy name: "নাম (কপি)", "নাম (কপি) ২", …
          const taken = new Set(s.scenes.map((es) => es.name));
          let name = `${base} (কপি)`;
          let n = 2;
          while (taken.has(name)) name = `${base} (কপি) ${n++}`;
          const copy = cloneEpisodeScene(src, name);
          const at = s.scenes.findIndex((es) => es.id === id);
          const scenes = [...s.scenes];
          scenes.splice(at + 1, 0, copy);
          return { scenes, activeSceneId: copy.id };
        }),
      deleteScene: (id) =>
        set((s) => {
          if (s.scenes.length <= 1) return {}; // never leave zero scenes
          const at = s.scenes.findIndex((es) => es.id === id);
          if (at < 0) return {};
          const scenes = s.scenes.filter((es) => es.id !== id);
          const activeSceneId =
            s.activeSceneId === id
              ? (scenes[Math.min(at, scenes.length - 1)]?.id ?? scenes[0].id)
              : s.activeSceneId;
          return { scenes, activeSceneId };
        }),
      renameScene: (id, name) =>
        set((s) => ({
          scenes: s.scenes.map((es) =>
            es.id === id ? { ...es, name: name.trim() || es.name } : es,
          ),
        })),
      moveScene: (id, dir) =>
        set((s) => {
          const at = s.scenes.findIndex((es) => es.id === id);
          const to = at + dir;
          if (at < 0 || to < 0 || to >= s.scenes.length) return {};
          const scenes = [...s.scenes];
          [scenes[at], scenes[to]] = [scenes[to], scenes[at]];
          return { scenes };
        }),
      setSceneTransition: (id, t) =>
        set((s) => ({
          scenes: s.scenes.map((es) =>
            es.id === id ? { ...es, transition: t } : es,
          ),
        })),
      loadEpisodes: (scenes, designs, activeId) =>
        set(() => {
          const list = scenes.length > 0 ? scenes : [initialEpisode];
          const activeSceneId = list.some((es) => es.id === activeId)
            ? (activeId as string)
            : list[0].id;
          return { designs, scenes: list, activeSceneId };
        }),

      // Sprint 6 — cinematic camera
      addCameraShot: (shot) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            camera: {
              shots: [...(sc.camera?.shots ?? []), { ...shot, id: newId() }],
              shake: sc.camera?.shake,
            },
          })),
        ),
      updateCameraShot: (id, patch) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            camera: {
              shots: (sc.camera?.shots ?? []).map((x) =>
                x.id === id ? { ...x, ...patch } : x,
              ),
              shake: sc.camera?.shake,
            },
          })),
        ),
      removeCameraShot: (id) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            camera: {
              shots: (sc.camera?.shots ?? []).filter((x) => x.id !== id),
              shake: sc.camera?.shake,
            },
          })),
        ),
      setCameraShake: (on) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            camera: { shots: sc.camera?.shots ?? [], shake: on },
          })),
        ),

      // ---- Phase 4 — সাউন্ড স্টুডিও ----
      setSceneMusic: (trackId, volume) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            audio: {
              ...sc.audio,
              music: trackId && trackId !== 'none' ? trackId : undefined,
              musicVolume:
                volume != null
                  ? Math.max(0, Math.min(1, volume))
                  : (sc.audio?.musicVolume ?? 0.55),
              sfx: sc.audio?.sfx ?? [],
            },
          })),
        ),
      setSceneMusicVolume: (volume) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            audio: {
              ...sc.audio,
              music: sc.audio?.music,
              musicVolume: Math.max(0, Math.min(1, volume)),
              sfx: sc.audio?.sfx ?? [],
            },
          })),
        ),
      setSfxEvents: (events) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            audio: {
              ...sc.audio,
              music: sc.audio?.music,
              musicVolume: sc.audio?.musicVolume ?? 0.55,
              sfx: events,
            },
          })),
        ),

      // ---- Phase 5 — জগৎ তৈরি ----
      setSceneEnvironment: (patch) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            environment: {
              timeOfDay: 'day',
              weather: 'none',
              intensity: 0.6,
              warmth: 0,
              ...sc.environment,
              ...patch,
            },
          })),
        ),
      addDecor: (decorId) =>
        set((s) =>
          withActive(s, (sc) => {
            const n = (sc.decor ?? []).length;
            return {
              ...sc,
              decor: [
                ...(sc.decor ?? []),
                {
                  uid: newId(),
                  decorId,
                  x: n === 0 ? 22 : ((n * 29) % 76) + 8,
                  scale: 1,
                  z: 0,
                },
              ],
            };
          }),
        ),
      updateDecor: (uid, patch) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            decor: (sc.decor ?? []).map((d) =>
              d.uid === uid ? { ...d, ...patch } : d,
            ),
          })),
        ),
      removeDecor: (uid) =>
        set((s) =>
          withActive(s, (sc) => ({
            ...sc,
            decor: (sc.decor ?? []).filter((d) => d.uid !== uid),
          })),
        ),

      // Sprint 8 — real implementations are injected by history()
      undo: () => {},
      redo: () => {},
      canUndo: false,
      canRedo: false,
    }),
    {
      name: 'thatta-studio-v1',
      // history helpers must not be persisted — only creative content is
      partialize: (s) => ({
        designs: s.designs,
        scenes: s.scenes,
        activeSceneId: s.activeSceneId,
      }),
      /**
       * Normalize + sanitize on load, AND migrate the pre-Phase-2 shape
       * ({ designs, scene }) into a one-scene episode. merge() (not
       * onRehydrateStorage!) because the callback form runs during create()
       * where referencing this store throws a swallowed TDZ error that
       * silently kills hydration (found during Phase 1 browser verification).
       */
      merge: (persisted, current) => {
        const p = persisted as
          | (Partial<StudioState> & { scene?: Scene })
          | undefined;
        const designs = Array.isArray(p?.designs)
          ? (p.designs as CharacterDesign[])
          : current.designs;

        let scenes: EpisodeScene[];
        if (Array.isArray(p?.scenes) && p.scenes.length > 0) {
          scenes = p.scenes as EpisodeScene[];
        } else if (p?.scene) {
          // legacy single-scene project → wrap it
          scenes = [
            {
              id: newId(),
              name: 'দৃশ্য ১',
              scene: p.scene as Scene,
            },
          ];
        } else {
          scenes = current.scenes;
        }

        const activeSceneId = scenes.some((es) => es.id === p?.activeSceneId)
          ? (p!.activeSceneId as string)
          : scenes[0].id;

        return { ...current, designs, scenes, activeSceneId };
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

/** The episode scene currently on the stage (always defined). */
export function activeEpisodeOf(state: {
  scenes: EpisodeScene[];
  activeSceneId: string;
}): EpisodeScene {
  return (
    state.scenes.find((es) => es.id === state.activeSceneId) ??
    state.scenes[0]
  );
}
