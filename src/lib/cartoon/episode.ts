// ============================================================
// ঠাট্টা স্টুডিও — Phase 2: multi-scene episode timeline math
//
// Pure helpers shared by realtime playback, the scene strip and the
// MP4 exporter. All timing mirrors the engine's own rules
// (computeBeatWindows + audio-aware durations), so what you scrub is
// exactly what renders and what exports.
// ============================================================

import { computeBeatWindows, sceneTotalDuration } from './engine';
import type { CachedAudio } from '@/lib/tts-cache';
import type { EpisodeScene, Scene } from './types';

/** Audio-aware engine duration for one beat (mirrors studio-tab rules). */
export function effectiveBeatDur(
  beat: { id: string; duration: number },
  audioOf?: (beatId: string) => CachedAudio | undefined,
): number {
  const a = audioOf?.(beat.id);
  return Math.max(0.3, a ? Math.max(beat.duration, a.duration + 0.3) : beat.duration);
}

/** Durations map (beatId → seconds) fed to the engine for one scene. */
export function audioDurMap(
  scene: Scene,
  audioOf?: (beatId: string) => CachedAudio | undefined,
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!audioOf) return map;
  for (const b of scene.beats) {
    const a = audioOf(b.id);
    if (a) map[b.id] = Math.max(b.duration, a.duration + 0.3);
  }
  return map;
}

export interface SceneTiming {
  /** audio-aware length of the scene (min 1.2s so an empty shot still reads) */
  duration: number;
  /** absolute start of the scene on the episode timeline */
  offset: number;
}

export interface EpisodeTiming {
  scenes: SceneTiming[];
  /** total episode length (sum of scene durations) */
  total: number;
}

/** One scene's beat windows (audio-aware). */
export function sceneBeatWindows(
  scene: Scene,
  audioOf?: (beatId: string) => CachedAudio | undefined,
): { id: string; start: number; end: number }[] {
  return computeBeatWindows(scene, audioDurMap(scene, audioOf)).map((w) => ({
    id: w.beat.id,
    start: w.start,
    end: w.end,
  }));
}

/**
 * Sequential episode timing. A scene with no beats still gets a short
 * establishing-shot length so the background/cast show on screen.
 */
export function episodeTiming(
  scenes: EpisodeScene[],
  audioOf?: (beatId: string) => CachedAudio | undefined,
): EpisodeTiming {
  const timings: SceneTiming[] = [];
  let offset = 0;
  for (const es of scenes) {
    const raw = sceneTotalDuration(es.scene, audioDurMap(es.scene, audioOf));
    const duration = Math.max(es.scene.beats.length > 0 ? 0.6 : 1.2, raw);
    timings.push({ duration, offset });
    offset += duration;
  }
  return { scenes: timings, total: offset };
}

/** Locate (sceneIndex, localTime) for an absolute episode time. */
export function locateInEpisode(
  timing: EpisodeTiming,
  t: number,
): { index: number; localT: number } {
  const total = timing.total;
  const clamped = Math.max(0, Math.min(t, Math.max(0, total - 0.001)));
  for (let i = 0; i < timing.scenes.length; i++) {
    const s = timing.scenes[i];
    if (clamped < s.offset + s.duration || i === timing.scenes.length - 1) {
      return { index: i, localT: clamped - s.offset };
    }
  }
  return { index: 0, localT: 0 };
}

/** All dialogue buses for an episode export, shifted by scene offsets. */
export function episodeAudioBuses(
  scenes: EpisodeScene[],
  timing: EpisodeTiming,
  audioOf: (beatId: string) => CachedAudio | undefined,
): { start: number; audio: CachedAudio }[] {
  const buses: { start: number; audio: CachedAudio }[] = [];
  scenes.forEach((es, i) => {
    const off = timing.scenes[i]?.offset ?? 0;
    for (const w of sceneBeatWindows(es.scene, audioOf)) {
      const a = audioOf(w.id);
      if (a) buses.push({ start: off + w.start, audio: a });
    }
  });
  return buses;
}
