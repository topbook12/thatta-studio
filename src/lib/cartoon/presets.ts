// ============================================================
// ঠাট্টা স্টুডিও — Presets: palettes, part options, sample designs
// ============================================================

import type {
  ActionName,
  BgName,
  CharacterDesign,
  CustomEasing,
  EasingName,
  EpisodeScene,
  PlacedCharacter,
  PoseOffset,
  PropName,
  Scene,
  SceneBeat,
  SceneTransition,
} from './types';

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---------------- Palettes ----------------

export const SKIN_TONES = [
  { value: '#ffe0bd', label: 'ফর্সা' },
  { value: '#f6c99f', label: 'হালকা' },
  { value: '#eab88a', label: 'মাঝারি' },
  { value: '#d9a066', label: 'কাঁচা' },
  { value: '#b97a4a', label: 'তামাটে' },
  { value: '#8d5a2b', label: 'গাঢ়' },
];

export const HAIR_COLORS = ['#1f1c18', '#3d2b1f', '#5a3a22', '#7a5230', '#9b9b9b', '#e8e6e1'];

export const CLOTH_COLORS = [
  '#ea580c', // orange
  '#e11d48', // rose
  '#f59e0b', // amber
  '#10b981', // emerald
  '#0d9488', // teal
  '#7c3aed', // violet
  '#a16207', // khaki
  '#dc2626', // red
  '#15803d', // green
  '#ca8a04', // dark yellow
  '#374151', // charcoal
  '#111827', // near-black
  '#e5e7eb', // light gray
  '#fef3c7', // cream
];

// ---------------- Part options (Bangla labels) ----------------

export const HAIR_STYLES = ['টাক (পালোয়ান)', 'ছোট চুল', 'কাঁকানো চুল', 'মাঝ বিভক্ত চুল', 'লম্বা চুল', 'খোপা'];
export const EYE_STYLES = ['গোল চোখ', 'ডিম্বাকৃতি চোখ', 'সরু চোখ', 'বড় বাচ্চা চোখ'];
export const BROW_STYLES = ['সাধারণ', 'মোটা ভুরু', 'উঁচু ভুরু'];
export const MOUTH_STYLES = ['হাসি', 'সোজা', 'ভ্যু হাসি', 'খোলা হাসি'];
export const TOP_STYLES = ['টি-শার্ট', 'পাঞ্জাবি', 'শার্ট', 'কুর্তি (মেয়ে)', 'ভেস্ট'];
export const BOTTOM_STYLES = ['প্যান্ট', 'লুঙ্গি', 'পায়জামা', 'স্কার্ট'];
export const HEADWEAR_STYLES = ['কিছু না', 'টুপি', 'ক্যাপ', 'পাগড়ি'];
export const BEARD_STYLES = ['কিছু না', 'গোঁফ', 'দাড়ি', 'গোঁফ + দাড়ি'];

export const VOICE_OPTIONS = [
  { id: 'tongtong', label: 'তংতং — নরম কণ্ঠ' },
  { id: 'chuichui', label: 'চুইচুই — মজার কণ্ঠ' },
  { id: 'kazi', label: 'কাজি — স্পষ্ট কণ্ঠ' },
  { id: 'douji', label: 'দোউজি — ঝরঝরে কণ্ঠ' },
  { id: 'xiaochen', label: 'শিয়াওচেন — গমগমে কণ্ঠ' },
  { id: 'jam', label: 'জ্যাম — স্টাইলিশ কণ্ঠ' },
  { id: 'luodo', label: 'লুওদো — আবেগি কণ্ঠ' },
];

export const ACTION_OPTIONS: { id: ActionName; label: string; emoji: string }[] = [
  { id: 'idle', label: 'দাঁড়িয়ে আছে', emoji: '🧍' },
  { id: 'talk', label: 'কথা বলছে', emoji: '💬' },
  { id: 'walk', label: 'হাঁটছে', emoji: '🚶' },
  { id: 'run', label: 'দৌড়াচ্ছে', emoji: '🏃' },
  { id: 'wave', label: 'হাত নাড়ছে', emoji: '👋' },
  { id: 'laugh', label: 'হাসছে', emoji: '😂' },
  { id: 'point', label: 'ইশারা করছে', emoji: '👉' },
  { id: 'angry', label: 'রেগে আছে', emoji: '😠' },
  { id: 'slap', label: 'চাপরাস মারছে', emoji: '🖐️' },
  { id: 'kick', label: 'লাথি মারছে', emoji: '🦵' },
  { id: 'push', label: 'ঠেলছে', emoji: '💪' },
  { id: 'bow', label: 'নমস্কার করছে', emoji: '🙏' },
  { id: 'think', label: 'ভাবছে', emoji: '🤔' },
  { id: 'surprise', label: 'অবাক হয়েছে', emoji: '😲' },
  { id: 'shiver', label: 'ভয়ে কাঁপছে', emoji: '😨' },
  { id: 'dance', label: 'নাচছে', emoji: '💃' },
  { id: 'jump', label: 'লাফাচ্ছে', emoji: '🤸' },
  { id: 'celebrate', label: 'জয়ধোঁয়া করছে', emoji: '🎉' },
  { id: 'eat', label: 'মিষ্টি খাচ্ছে', emoji: '😋' },
  { id: 'sleep', label: 'ঘুমাচ্ছে', emoji: '😴' },
  { id: 'sneak', label: 'চুরির প্ল্যানে', emoji: '🥷' },
  { id: 'fall', label: 'পড়ে যাচ্ছে', emoji: '🤕' },
  { id: 'nod', label: 'মাথা নাড়ছে', emoji: '🙂' },
  { id: 'cry', label: 'কাঁদছে', emoji: '😭' },
  { id: 'turn', label: 'ঘুরে দাঁড়াচ্ছে (3D)', emoji: '🔄' },
  { id: 'carry', label: 'মাথায় বোঝা বইছে', emoji: '📦' },
  { id: 'clap', label: 'হাত তালি দিচ্ছে', emoji: '👏' },
  { id: 'salute', label: 'স্যালুট করছে', emoji: '🫡' },
];

/** walk/run এর গতিপথের easing অপশন */
export const EASING_OPTIONS: { id: EasingName; label: string }[] = [
  { id: 'easeInOut', label: 'মসৃণ (স্বাভাবিক)' },
  { id: 'linear', label: 'সমান গতি' },
  { id: 'easeIn', label: 'ধীরে শুরু' },
  { id: 'easeOut', label: 'ধীরে শেষ' },
  { id: 'backOut', label: 'একটু এগিয়ে-পিছিয়ে' },
  { id: 'elasticOut', label: 'স্প্রিং এর মতো' },
  { id: 'custom', label: 'নিজের কার্ভ (গ্রাফে টানুন)' },
];

/** Phase 3 — walk/run গতিপথের আকৃতি (motion path) */
export const PATH_STYLE_OPTIONS: { id: 'straight' | 'arc' | 'sCurve'; label: string; emoji: string }[] = [
  { id: 'straight', label: 'সোজা পথ', emoji: '➡️' },
  { id: 'arc', label: 'বাঁকা পথ', emoji: '🌊' },
  { id: 'sCurve', label: 'S-আকৃতির পথ', emoji: '〰️' },
];

/**
 * Phase 3 — actions that blend nicely ON TOP of another action
 * (upper-body gestures that don't fight the primary locomotion).
 */
export const SECONDARY_ACTIONS: { id: ActionName; label: string; emoji: string }[] = [
  { id: 'wave', label: 'হাত নাড়ছে', emoji: '👋' },
  { id: 'point', label: 'ইশারা করছে', emoji: '👉' },
  { id: 'clap', label: 'হাত তালি', emoji: '👏' },
  { id: 'nod', label: 'মাথা নাড়ছে', emoji: '🙂' },
  { id: 'think', label: 'ভাবছে', emoji: '🤔' },
  { id: 'salute', label: 'স্যালুট', emoji: '🫡' },
  { id: 'eat', label: 'মিষ্টি খাচ্ছে', emoji: '😋' },
  { id: 'carry', label: 'মাথায় বোঝা', emoji: '📦' },
];

/** গ্লোবাল প্লেব্যাক স্পিড অপশন */
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** ভয়েসের কথার গতি (TTS speaking rate) — Sprint 5 */
export const VOICE_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

export const BG_OPTIONS: { id: BgName; label: string }[] = [
  { id: 'village', label: '🏡 গ্রামের বাড়ি' },
  { id: 'bazaar', label: '🏪 বাজার' },
  { id: 'field', label: '🌾 ধানখেত' },
  { id: 'river', label: '⛵ নদীপথ' },
  { id: 'pond', label: '🛶 পুকুরপাড়' },
  { id: 'jungle', label: '🌴 জঙ্গলের পথ' },
  { id: 'room', label: '🛋️ ঘরের ভেতর' },
  { id: 'kitchen', label: '🍳 রান্নাঘর' },
  { id: 'rajcourt', label: '👑 রাজসভা' },
  { id: 'temple', label: '🪔 কালীবাড়ি' },
  { id: 'school', label: '🏫 স্কুল' },
  { id: 'ghat', label: '🛕 ঘাট' },
  { id: 'night', label: '🌙 রাতের গ্রাম' },
];

/** হাতে ধরা যায় এমন প্রপ (Sprint 2 + Sprint 4) */
export const PROP_OPTIONS: { id: PropName; label: string; emoji: string }[] = [
  { id: 'none', label: 'কিছু না', emoji: '🚫' },
  { id: 'stick', label: 'লাঠি', emoji: '🦯' },
  { id: 'umbrella', label: 'ছাতা', emoji: '☂️' },
  { id: 'pot', label: 'কলসি', emoji: '🏺' },
  { id: 'basket', label: 'মাছের টোকরি', emoji: '🧺' },
  { id: 'fan', label: 'হাতপাখা', emoji: '🪭' },
  { id: 'laddu', label: 'মিষ্টির থালা', emoji: '🍬' },
  { id: 'book', label: 'পোথি', emoji: '📖' },
  { id: 'lamp', label: 'কুপি', emoji: '🏮' },
  { id: 'sack', label: 'বস্তা', emoji: '🎒' },
  { id: 'flower', label: 'ফুলের তোড়া', emoji: '🌸' },
];

// ---------------- Design factory ----------------

export function makeDesign(partial: Partial<CharacterDesign> = {}): CharacterDesign {
  return {
    id: newId(),
    name: 'নতুন ক্যারেক্টার',
    gender: 'male',
    skin: SKIN_TONES[2].value,
    hairStyle: 1,
    hairColor: HAIR_COLORS[0],
    eyeStyle: 0,
    browStyle: 0,
    mouthStyle: 0,
    topStyle: 0,
    topColor: CLOTH_COLORS[0],
    bottomStyle: 0,
    bottomColor: CLOTH_COLORS[10],
    headwearStyle: 0,
    headwearColor: CLOTH_COLORS[13],
    beardStyle: 0,
    glasses: false,
    voice: 'tongtong',
    voicePitch: 0,
    ...partial,
  };
}

// ---------------- Ready-made sample cast ----------------

export function presetCast(): CharacterDesign[] {
  return [
    makeDesign({
      name: 'গোপাল',
      skin: SKIN_TONES[2].value,
      hairStyle: 2,
      hairColor: HAIR_COLORS[0],
      eyeStyle: 3,
      browStyle: 1,
      mouthStyle: 0,
      topStyle: 1,
      topColor: CLOTH_COLORS[0],
      bottomStyle: 1,
      bottomColor: CLOTH_COLORS[13],
      voice: 'chuichui',
    }),
    makeDesign({
      name: 'মশিমা',
      gender: 'female',
      skin: SKIN_TONES[1].value,
      hairStyle: 4,
      hairColor: HAIR_COLORS[1],
      eyeStyle: 1,
      browStyle: 0,
      mouthStyle: 0,
      topStyle: 3,
      topColor: CLOTH_COLORS[1],
      bottomStyle: 3,
      bottomColor: CLOTH_COLORS[4],
      voice: 'tongtong',
    }),
    makeDesign({
      name: 'মামা পুলিশ',
      skin: SKIN_TONES[3].value,
      hairStyle: 1,
      hairColor: HAIR_COLORS[0],
      eyeStyle: 0,
      browStyle: 1,
      mouthStyle: 1,
      topStyle: 2,
      topColor: CLOTH_COLORS[6],
      bottomStyle: 0,
      bottomColor: CLOTH_COLORS[10],
      headwearStyle: 2,
      headwearColor: CLOTH_COLORS[6],
      beardStyle: 1,
      voice: 'xiaochen',
    }),
    makeDesign({
      name: 'দাদু',
      skin: SKIN_TONES[1].value,
      hairStyle: 0,
      hairColor: HAIR_COLORS[5],
      eyeStyle: 2,
      browStyle: 0,
      mouthStyle: 1,
      topStyle: 1,
      topColor: CLOTH_COLORS[13],
      bottomStyle: 2,
      bottomColor: CLOTH_COLORS[12],
      headwearStyle: 1,
      headwearColor: CLOTH_COLORS[12],
      beardStyle: 3,
      voice: 'xiaochen',
    }),
    makeDesign({
      name: 'বন্ধু মিয়া',
      skin: SKIN_TONES[3].value,
      hairStyle: 3,
      hairColor: HAIR_COLORS[0],
      eyeStyle: 0,
      browStyle: 2,
      mouthStyle: 3,
      topStyle: 0,
      topColor: CLOTH_COLORS[4],
      bottomStyle: 0,
      bottomColor: CLOTH_COLORS[11],
      headwearStyle: 2,
      headwearColor: CLOTH_COLORS[11],
      voice: 'douji',
    }),
  ];
}

// ---------------- Scene normalization (backward compatibility) ----------------

/** sequential start for beat i when an old project has no absolute starts */
function sequentialStart(beats: SceneBeat[], i: number): number {
  let acc = 0;
  for (let j = 0; j < i; j++) acc += Math.max(0.3, beats[j].duration);
  return acc;
}

/**
 * Phase 3 — clamp user-drawn pose offsets into safe ranges and drop
 * all-zero offsets (undefined = use the pure action pose).
 */
export function sanitizePoseOffset(po: PoseOffset): PoseOffset | undefined {
  const clamp = (v: number | undefined, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.max(lo, Math.min(hi, Math.round(v * 1000) / 1000))
      : undefined;
  const out: PoseOffset = {
    bodyLean: clamp(po.bodyLean, -0.7, 0.7),
    headTilt: clamp(po.headTilt, -0.9, 0.9),
    shoulderR: clamp(po.shoulderR, -1.2, 1.2),
    elbowR: clamp(po.elbowR, -1.4, 1.4),
    shoulderL: clamp(po.shoulderL, -1.2, 1.2),
    elbowL: clamp(po.elbowL, -1.4, 1.4),
    yOff: clamp(po.yOff, -24, 48),
  };
  const any = Object.values(out).some((v) => typeof v === 'number' && Math.abs(v) > 0.001);
  return any ? out : undefined;
}

/** clamp a custom cubic-bezier into valid control points */
export function sanitizeCustomEasing(c: CustomEasing): CustomEasing {
  const cl = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Math.round(v * 1000) / 1000));
  return [cl(c[0], 0, 1), cl(c[1], -0.4, 1.4), cl(c[2], 0, 1), cl(c[3], -0.4, 1.4)];
}

/**
 * Fill in absolute `start` times for beats loaded from old projects and
 * clamp walk/speed fields into safe ranges. Idempotent.
 * Sprint 6: also normalizes depth (z/moveZ) and the cinematic camera.
 */
export function normalizeScene(scene: Scene): Scene {
  const beats: SceneBeat[] = scene.beats.map((b, i) => {
    const start =
      typeof b.start === 'number' && b.start >= 0
        ? Math.round(b.start * 100) / 100
        : Math.round(sequentialStart(scene.beats, i) * 100) / 100;
    return {
      ...b,
      start,
      moveTo:
        b.action === 'walk' || b.action === 'run' ? b.moveTo : undefined,
      moveZ:
        b.action === 'walk' || b.action === 'run'
          ? Math.max(-120, Math.min(480, Math.round(b.moveZ ?? 0)))
          : undefined,
      // Phase 3 — movement-only fields stay movement-only
      easing:
        b.action === 'walk' || b.action === 'run'
          ? b.easing ?? 'easeInOut'
          : undefined,
      customEasing:
        (b.action === 'walk' || b.action === 'run') &&
        Array.isArray(b.customEasing) &&
        b.customEasing.length === 4 &&
        b.customEasing.every((n) => typeof n === 'number' && Number.isFinite(n))
          ? ([...b.customEasing] as [number, number, number, number])
          : undefined,
      pathStyle:
        b.action === 'walk' || b.action === 'run'
          ? b.pathStyle === 'arc' || b.pathStyle === 'sCurve'
            ? b.pathStyle
            : 'straight'
          : undefined,
      // blending: the secondary must not equal the primary (that's a no-op)
      action2:
        b.action2 && b.action2 !== 'idle' && b.action2 !== b.action
          ? b.action2
          : undefined,
      poseOffset: b.poseOffset ? sanitizePoseOffset(b.poseOffset) : undefined,
      speed:
        b.speed != null
          ? Math.max(0.25, Math.min(2.5, b.speed))
          : undefined,
    };
  });
  const characters = scene.characters.map((c) => ({
    ...c,
    z: c.z != null ? Math.max(-120, Math.min(480, Math.round(c.z))) : undefined,
  }));
  const camera = {
    shots: (scene.camera?.shots ?? [])
      .filter((s) => s.end > s.start)
      .map((s) => ({
        ...s,
        start: Math.max(0, Math.round(s.start * 20) / 20),
        end: Math.max(0.3, Math.round(s.end * 20) / 20),
        zoom: Math.max(1, Math.min(2.4, s.zoom ?? 1.3)),
      })),
    shake: scene.camera?.shake !== false,
  };
  // Phase 4 — soundtrack sanitization (tolerates old/garbage data)
  const validMusic =
    typeof scene.audio?.music === 'string' &&
    scene.audio.music !== 'none' &&
    scene.audio.music !== ''
      ? scene.audio.music
      : undefined;
  const audio =
    scene.audio || validMusic
      ? {
          music: validMusic,
          musicVolume:
            typeof scene.audio?.musicVolume === 'number'
              ? Math.max(0, Math.min(1, scene.audio.musicVolume))
              : 0.55,
          sfx: (scene.audio?.sfx ?? [])
            .filter(
              (e) =>
                e &&
                typeof e.sfx === 'string' &&
                e.sfx.length > 0 &&
                typeof e.at === 'number' &&
                Number.isFinite(e.at),
            )
            .map((e) => ({
              ...e,
              at: Math.max(0, Math.round(e.at * 20) / 20),
              volume:
                typeof e.volume === 'number'
                  ? Math.max(0, Math.min(1.5, e.volume))
                  : 1,
            })),
        }
      : undefined;
  return { ...scene, beats, characters, camera, audio };
}

// ---------------- Phase 2: multi-scene episode helpers ----------------

/**
 * Sanitize an episode loaded from storage/projects. Idempotent:
 *  • keeps only structurally valid scenes (arrays + string background)
 *  • normalizeScene() every scene (old projects may miss start times)
 *  • guarantees non-empty names and unique ids
 *  • never returns an empty list (falls back to a single fresh scene)
 */
export function normalizeEpisodes(
  input: unknown,
  fallbackScene: () => Scene,
): EpisodeScene[] {
  const raw = Array.isArray(input) ? input : [];
  const usedIds = new Set<string>();
  const out: EpisodeScene[] = [];
  raw.forEach((item, i) => {
    const es = item as Partial<EpisodeScene> | undefined;
    const sc = es?.scene as Scene | undefined;
    if (
      !sc ||
      typeof sc !== 'object' ||
      !Array.isArray(sc.beats) ||
      !Array.isArray(sc.characters) ||
      typeof sc.background !== 'string'
    ) {
      return;
    }
    let id = typeof es?.id === 'string' && es.id ? es.id : newId();
    while (usedIds.has(id)) id = newId();
    usedIds.add(id);
    const name =
      typeof es?.name === 'string' && es.name.trim()
        ? es.name.trim()
        : `দৃশ্য ${bn(i + 1)}`;
    const transition: SceneTransition =
      es?.transition === 'fade' || es?.transition === 'circle'
        ? es.transition
        : 'cut';
    out.push({ id, name, scene: normalizeScene(sc), transition });
  });
  if (out.length === 0) {
    out.push({ id: newId(), name: 'দৃশ্য ১', scene: fallbackScene() });
  }
  return out;
}

/** Bengali digits for generated scene names */
const bn = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

/** Sequential Bengali default name — always unique within the episode. */
export function nextSceneName(scenes: EpisodeScene[]): string {
  const base = (n: number) => `দৃশ্য ${bn(n)}`;
  let n = scenes.length + 1;
  const taken = new Set(scenes.map((s) => s.name));
  while (taken.has(base(n))) n++;
  return base(n);
}

/**
 * A fresh scene placed after the current one: same background, same cast
 * (positions preserved), zero beats — "next shot, same characters".
 */
export function freshEpisodeScene(
  name: string,
  from: Scene | undefined,
): EpisodeScene {
  return {
    id: newId(),
    name,
    scene: normalizeScene({
      background: from?.background ?? 'village',
      characters: from ? from.characters.map((c) => ({ ...c })) : [],
      beats: [],
      camera: from?.camera ? { shots: [], shake: from.camera.shake } : undefined,
    }),
  };
}

/** True copy with ALL ids regenerated (uids, beat ids, camera shot ids). */
export function cloneEpisodeScene(src: EpisodeScene, name: string): EpisodeScene {
  const uidMap = new Map<string, string>();
  for (const c of src.scene.characters) uidMap.set(c.uid, newId());
  return {
    id: newId(),
    name,
    transition: src.transition ?? 'cut',
    scene: normalizeScene({
      background: src.scene.background,
      characters: src.scene.characters.map((c) => ({
        ...c,
        uid: uidMap.get(c.uid) ?? newId(),
      })),
      beats: src.scene.beats.map((b) => ({
        ...b,
        id: newId(),
        actorUid: uidMap.get(b.actorUid) ?? b.actorUid,
      })),
      camera: src.scene.camera
        ? {
            shots: src.scene.camera.shots.map((s) => ({
              ...s,
              id: newId(),
              focusUid: s.focusUid ? (uidMap.get(s.focusUid) ?? null) : null,
            })),
            shake: src.scene.camera.shake,
          }
        : undefined,
    }),
  };
}

// ---------------- Starter scene (demo cartoon) ----------------

export function starterScene(cast: CharacterDesign[]): Scene {
  const byName = (n: string) => cast.find((c) => c.name === n)!;
  const gopal = byName('গোপাল');
  const police = byName('মামা পুলিশ');
  const placedGopal: PlacedCharacter = {
    uid: newId(),
    designId: gopal.id,
    x: 32,
    scale: 1.15,
    flip: false,
    prop: 'laddu', // গোপালের হাতে মিষ্টি — Sprint 4
  };
  const placedPolice: PlacedCharacter = {
    uid: newId(),
    designId: police.id,
    x: 72,
    scale: 1.25,
    flip: true,
  };
  const beats: Array<Omit<SceneBeat, 'id' | 'actorUid'>> = [
    {
      action: 'wave',
      start: 0,
      duration: 3,
      text: 'ওই মামা! কী রে, কাজে ধরলি আমারে?',
    },
    {
      // parallel track — police starts while Gopal is still finishing 👥
      action: 'angry',
      start: 2.6,
      duration: 4,
      text: 'তুই কলকের সেই নটকি গোপাল! বাজারে গন্ডগোল করস কেন?',
    },
    {
      action: 'laugh',
      start: 6.4,
      duration: 3,
      text: 'হা হা হা! মামা, আসলে মজা করছিলাম শুধু!',
    },
    {
      action: 'point',
      start: 9.2,
      duration: 3.5,
      text: 'এইবার দেখলাম তোকে! আর করলে থানায় যাবি!',
    },
    {
      // walk beat — the green destination flag can be dragged on the stage
      action: 'walk',
      start: 12.6,
      duration: 3.2,
      moveTo: 58,
      easing: 'easeInOut',
      text: 'জ্যে মামা! ভুল করিনি আর কখনো, কথা দিলাম!',
    },
    {
      // Sprint 4 finale — Gopal eats his laddus (hand-prop follows the action!)
      action: 'eat',
      start: 15.8,
      duration: 3,
      text: 'এবার মিষ্টির মজা! মুহুঁ মুহুঁ...',
    },
    {
      // জয় গোপাল! (new celebrate action)
      action: 'celebrate',
      start: 18.8,
      duration: 2.8,
      text: 'জয় গোপাল! মিষ্টি তো আছেই, ভয় কীসের!',
    },
  ];
  return {
    background: 'village',
    characters: [placedGopal, placedPolice],
    beats: beats.map((b, i) => ({
      ...b,
      id: newId(),
      // explicit actor per line (finale lines are all Gopal's)
      actorUid:
        i === 1 || i === 3 ? placedPolice.uid : placedGopal.uid,
    })),
  };
}
