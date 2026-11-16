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
  | 'sneak' // চুরির প্ল্যানে টিপটো
  // Sprint 6 — pseudo-3D movement
  | 'turn' // ঘুরে দাঁড়াচ্ছে (3D perspective flip)
  // Sprint 9 — movement expansion
  | 'carry' // মাথায় বোঝা বইছে (heavy load overhead)
  | 'clap' // হাত তালি দিচ্ছে (applause)
  | 'salute'; // স্যালুট করছে (crisp salute)

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
  /**
   * Sprint 6 — depth (Z) in px: 0 = stage plane, + = farther (smaller),
   * − = closer to the camera (bigger). Older saved scenes omit → 0.
   */
  z?: number;
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
  /**
   * Sprint 6 — walk/run can travel INTO the scene (3D depth path).
   * Target depth in px (−120..480). Omitted → stay at the current depth.
   */
  moveZ?: number;
}

/**
 * Sprint 6 — a cinematic camera shot: the virtual camera eases towards
 * a focus point (a character or a fixed pan position) and zooms in/out.
 * Pure function of scene time — deterministic for scrubbing & export.
 */
export interface CameraShot {
  id: string;
  /** seconds */
  start: number;
  /** seconds (exclusive) */
  end: number;
  /** zoom factor 1..2.4 */
  zoom: number;
  /** follow this character (chest-level tracking shot) */
  focusUid?: string | null;
  /** when focusUid is null: horizontal pan target, 0..100 (% of stage) */
  panX?: number;
  /** transition easing into the shot (default easeInOut) */
  easing?: EasingName;
}

/** Scene-level cinematic camera state. */
export interface SceneCamera {
  shots: CameraShot[];
  /** impact camera-shake on slap/jump/fall/kick (default true) */
  shake?: boolean;
}

export interface Scene {
  background: BgName;
  characters: PlacedCharacter[];
  beats: SceneBeat[];
  /** Sprint 6 — cinematic camera (older saved scenes omit) */
  camera?: SceneCamera;
}

/**
 * Phase 2 — মাল্টি-সিন এপিসোড: one named scene of a multi-scene episode.
 * An episode = an ordered list of EpisodeScene; playback and export run
 * through them sequentially. `transition` is the outgoing effect applied
 * at the END of this scene when the next scene begins (export path).
 */
export interface EpisodeScene {
  id: string;
  name: string;
  scene: Scene;
  /** outgoing transition into the next scene (default 'cut') */
  transition?: SceneTransition;
}

export type SceneTransition = 'cut' | 'fade' | 'circle';

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
  /**
   * Sprint 9 — cloth inertia: horizontal skew (px) of the lungi/skirt hem.
   * The fabric trails the body a beat late, so hem sway is derived from the
   * stride rhythm with a phase lag, not locked to the hips.
   */
  clothSway: number;
  /**
   * Sprint 9 — hair inertia: horizontal drift (px) of the long-hair tips.
   * Trails the head tilt + carries its own slow bounce (follow-through).
   */
  hairSway: number;
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
