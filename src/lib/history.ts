// ============================================================
// ঠাট্টা স্টুডিও — undo/redo history middleware (zustand)
//
// Snapshots the `designs` + `scene` slices on every mutation.
// Rapid consecutive changes (slider drags, character dragging on
// the stage) coalesce into ONE history entry within COALESCE_MS,
// so a single Ctrl+Z undoes a whole drag gesture, not one pixel.
//
// zustand subtlety: the FINAL store state is the creator's RETURN
// value, so the real undo/redo actions are injected there (not via
// an early api.setState, which would corrupt persist hydration).
// At runtime undo/redo go through api.setState — persisting the
// restored state and skipping history recording by design.
// ============================================================

import type { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';
import type { CharacterDesign, Scene } from './cartoon/types';

const HISTORY_LIMIT = 60;
const COALESCE_MS = 450;

interface Snapshot {
  designs: CharacterDesign[];
  scene: Scene;
}

export const history = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  creator: StateCreator<T, Mps, Mcs>,
): StateCreator<T, Mps, Mcs> =>
(set, get, api) => {
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];
  let lastPush = 0;

  const slices = (s: unknown) => s as { designs: CharacterDesign[]; scene: Scene };

  const wrappedSet: StoreApi<T>['setState'] = (partial, replace) => {
    const prev = slices(get());
    set(partial, replace);
    const next = slices(get());
    if (next.designs === prev.designs && next.scene === prev.scene) return;

    const now = Date.now();
    if (now - lastPush > COALESCE_MS) {
      past.push({ designs: prev.designs, scene: prev.scene });
      if (past.length > HISTORY_LIMIT) past.shift();
      future.length = 0;
      api.setState({ canUndo: true, canRedo: false } as never);
    } else {
      // coalesced with the previous entry — flags reflect current stacks
      api.setState({
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      } as never);
    }
    lastPush = now;
  };

  const undo = () => {
    const prevSnap = past.pop();
    if (!prevSnap) return;
    const cur = slices(get());
    future.push({ designs: cur.designs, scene: cur.scene });
    if (future.length > HISTORY_LIMIT) future.shift();
    // api.setState (not raw set): persists the restore AND bypasses wrappedSet
    api.setState({ designs: prevSnap.designs, scene: prevSnap.scene } as never);
    lastPush = 0;
    api.setState({ canUndo: past.length > 0, canRedo: true } as never);
  };

  const redo = () => {
    const nextSnap = future.pop();
    if (!nextSnap) return;
    const cur = slices(get());
    past.push({ designs: cur.designs, scene: cur.scene });
    if (past.length > HISTORY_LIMIT) past.shift();
    api.setState({ designs: nextSnap.designs, scene: nextSnap.scene } as never);
    lastPush = 0;
    api.setState({ canUndo: true, canRedo: future.length > 0 } as never);
  };

  // inject the real actions into the creator's RETURN value — zustand's
  // final state assignment is exactly this object
  const result = creator(wrappedSet as typeof set, get, api);
  return {
    ...result,
    undo,
    redo,
    canUndo: false,
    canRedo: false,
  } as T;
};
