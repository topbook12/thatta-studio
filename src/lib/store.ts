// ============================================================
// ঠাট্টা স্টুডিও — Global studio state (zustand + localStorage persist)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId, presetCast, starterScene } from './cartoon/presets';
import type {
  BgName,
  CharacterDesign,
  PlacedCharacter,
  Scene,
  SceneBeat,
} from './cartoon/types';

const initialCast = presetCast();
const initialScene = starterScene(initialCast);

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
  setScene: (s: Scene) => void;
  clearBeats: () => void;
}

export const useStudio = create<StudioState>()(
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
        set((s) => ({
          scene: { ...s.scene, beats: [...s.scene.beats, { ...beat, id: newId() }] },
        })),
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
      setScene: (sc) => set({ scene: sc }),
      clearBeats: () => set((s) => ({ scene: { ...s.scene, beats: [] } })),
    }),
    { name: 'thatta-studio-v1' },
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
