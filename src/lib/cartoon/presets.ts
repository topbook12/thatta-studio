// ============================================================
// ঠাট্টা স্টুডিও — Presets: palettes, part options, sample designs
// ============================================================

import type {
  ActionName,
  BgName,
  CharacterDesign,
  EasingName,
  PlacedCharacter,
  PropName,
  Scene,
  SceneBeat,
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
];

/** walk/run এর গতিপথের easing অপশন */
export const EASING_OPTIONS: { id: EasingName; label: string }[] = [
  { id: 'easeInOut', label: 'মসৃণ (স্বাভাবিক)' },
  { id: 'linear', label: 'সমান গতি' },
  { id: 'easeIn', label: 'ধীরে শুরু' },
  { id: 'easeOut', label: 'ধীরে শেষ' },
  { id: 'backOut', label: 'একটু এগিয়ে-পিছিয়ে' },
  { id: 'elasticOut', label: 'স্প্রিং এর মতো' },
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
 * Fill in absolute `start` times for beats loaded from old projects and
 * clamp walk/speed fields into safe ranges. Idempotent.
 * Sprint 6: also normalizes depth (z/moveZ) and the cinematic camera.
 */
export function normalizeScene(scene: Scene): Scene {
  const beats = scene.beats.map((b, i) => {
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
  return { ...scene, beats, characters, camera };
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
