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
  | 'cry';

export type BgName = 'village' | 'bazaar' | 'field' | 'room' | 'pond';

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

/** A character placed into the stage scene. */
export interface PlacedCharacter {
  uid: string;
  designId: string;
  /** horizontal position, 0..100 (% of stage width) */
  x: number;
  /** 0.8 .. 1.8 */
  scale: number;
  flip: boolean;
}

/** One action/dialogue unit of the cartoon ("beat"). */
export interface SceneBeat {
  id: string;
  actorUid: string;
  action: ActionName;
  /** seconds */
  duration: number;
  /** dialogue line — shown as subtitle & sent to TTS */
  text: string;
  /** optional walk target x (0..100) */
  moveTo?: number;
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
  eyeState: EyeState;
  browState: BrowState;
  expression: Expression;
  tears: boolean;
}

/** Callbacks for playback orchestration. */
export interface StageCallbacks {
  onBeat?: (index: number, beat: SceneBeat) => void;
  onFinish?: () => void;
}

export const STAGE_W = 1280;
export const STAGE_H = 720;
/** ground line (y px) where characters stand */
export const GROUND_Y = 636;
