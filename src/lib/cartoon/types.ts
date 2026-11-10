// ============================================================
// ঠাট্টা স্টুডিও — Core type definitions for the cartoon engine
// ============================================================

export type ActionName =
  | 'idle'
  | 'talk'
  | 'walk'
  | 'wave'
  | 'laugh'
  | 'point'
  | 'angry'
  | 'jump'
  | 'nod'
  | 'cry'
  | 'run'
  | 'slap'
  | 'bow'
  | 'think'
  | 'surprise'
  | 'dance'
  | 'fall'
  | 'push'
  // Sprint 4 asset-library expansion
  | 'kick' // লাথি মারছে
  | 'shiver' // ভয়ে কাঁপছে
  | 'eat' // মিষ্টি খাচ্ছে
  | 'sleep' // ঘুমাচ্ছে
  | 'celebrate' // জয়ধোঁয়া উদযাপন
  | 'sneak'; // চুরির প্ল্যানে টিপটো

export type BgName =
  | 'village'
  | 'bazaar'
  | 'field'
  | 'room'
  | 'pond'
  | 'rajcourt'
  | 'school'
  | 'ghat'
  | 'night'
  // Sprint 4 asset-library expansion
  | 'temple' // কালীবাড়ির উঠান
  | 'river' // নদীপথ — নৌকা
  | 'kitchen' // রান্নাঘর
  | 'jungle'; // জঙ্গলের পথ

/** Easing for beat-level movement (walk path etc.) */
export type EasingName =
  | 'linear'
  | 'easeInOut'
  | 'easeIn'
  | 'easeOut'
  | 'backOut'
  | 'elasticOut';

export type EyeState = 'open' | 'blink' | 'closed' | 'happy' | 'wide';
export type BrowState = 'normal' | 'angry' | 'raised' | 'sad';
export type Expression =
  | 'neutral'
  | 'smile'
  | 'frown'
  | 'laugh'
  | 'cry'
  | 'angry'
  | 'surprised';

/**
 * Face FX overlays — the “comic book” garnish that makes emotions readable
 * from far away (Sprint 2 expression engine v2).
 */
export type FaceFx =
  | 'angerVein' // 🔴 রাগের শিরা (cross-popping vein)
  | 'steam' // 💨 রাগের ধোঁয়া
  | 'sweat' // 💦 ঘাম ছিটকে যাওয়া
  | 'shockLines' // ❗ চমকে যাওয়ার দাগ
  | 'music' // 🎵 সুরের ফুলকি (dance)
  | 'blush' // 😊 লজ্জার লালচে ভাব
  | 'zzz'; // 💤 ঘুম

/** A fully-described cartoon character (parts-based). */
export interface CharacterDesign {
  id: string;
  name: string;
  gender: 'male' | 'female';
  skin: string;
  hairStyle: number;
  hairColor: string;
  eyeStyle: number;
  browStyle: number;
  mouthStyle: number;
  topStyle: number;
  topColor: string;
  bottomStyle: number;
  bottomColor: string;
  headwearStyle: number;
  headwearColor: string;
  beardStyle: number;
  glasses: boolean;
  /** TTS voice id (tongtong / chuichui / kazi / ...) */
  voice: string;
}

/** Props a character can hold in the (near) hand — Sprint 2. */
export type PropName =
  | 'none'
  | 'stick' // লাঠি
  | 'umbrella' // ছাতা
  | 'pot' // কলসি
  | 'basket' // মাছের টোকরি
  | 'fan' // হাতপাখা
  // Sprint 4 asset-library expansion
  | 'laddu' // মিষ্টির থালা
  | 'book' // পোথি/বই
  | 'lamp' // কুপি
  | 'sack' // বস্তা
  | 'flower'; // ফুলের তোড়া

/** A character placed into the stage scene. */
export interface PlacedCharacter {
  uid: string;
  designId: string;
  /** horizontal position, 0..100 (% of stage width) */
  x: number;
  /** 0.8 .. 1.8 */
  scale: number;
  flip: boolean;
  /** prop held in the near hand (older saved scenes may omit → 'none') */
  prop?: PropName;
}

/** One action/dialogue unit of the cartoon ("beat"). */
export interface SceneBeat {
  id: string;
  actorUid: string;
  action: ActionName;
  /**
   * absolute start time on the timeline (seconds).
   * Optional only for old saved projects — normalizeScene() fills it in.
   * Absolute starts enable parallel multi-track scenes: several characters
   * can act at the same time (conversation overlap!).
   */
  start?: number;
  /** seconds */
  duration: number;
  /** dialogue line — shown as subtitle & sent to TTS */
  text: string;
  /** optional walk target x (0..100) */
  moveTo?: number;
  /** animation speed multiplier for this beat (0.5..2, default 1) */
  speed?: number;
  /** easing used for the walk-to-target motion (default easeInOut) */
  easing?: EasingName;
  /** TTS voice speaking rate for this line (0.5..2, default 1) — Sprint 5 */
  voiceSpeed?: number;
}

export interface Scene {
  background: BgName;
  characters: PlacedCharacter[];
  beats: SceneBeat[];
}

/** Per-frame skeleton/face state computed from an action. */
export interface Pose {
  xOff: number;
  /** positive = up (units) */
  yOff: number;
  bodyLean: number;
  headTilt: number;
  headNod: number;
  shoulderL: number;
  elbowL: number;
  shoulderR: number;
  elbowR: number;
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  mouthOpen: number;
  /** horizontal mouth stretch 0..1 — viseme lip-sync “ee/ai” widening (Sprint 5) */
  mouthWide: number;
  eyeState: EyeState;
  browState: BrowState;
  expression: Expression;
  tears: boolean;
  /** squash & stretch: -1 = stretched tall, +1 = squashed wide, 0 = normal */
  squash: number;
  /** comic face FX overlays active this frame (expression engine v2) */
  fx?: FaceFx[];
  /** true when the near hand should render a gripping fist (slap, push…) */
  fist?: boolean;
}

/** Callbacks for playback orchestration. */
export interface StageCallbacks {
  /** a beat window just became active (fired once per activation) */
  onBeatStart?: (beat: SceneBeat, offset: number) => void;
  /** an active beat window just ended */
  onBeatEnd?: (beat: SceneBeat) => void;
  onTime?: (sceneTime: number, activeCount: number) => void;
  onFinish?: () => void;
}

/** Character/flag hit-drag interactions on the stage canvas. */
export interface StageInteractions {
  onPick?: (uid: string | null) => void;
  onDrag?: (uid: string, xPct: number) => void;
  onDragEnd?: (uid: string, xPct: number) => void;
  /** the walk-target flag of the edited beat is being dragged */
  onDragTarget?: (xPct: number) => void;
  onDragTargetEnd?: (xPct: number) => void;
}

export const STAGE_W = 1280;
export const STAGE_H = 720;
/** ground line (y px) where characters stand */
export const GROUND_Y = 636;
