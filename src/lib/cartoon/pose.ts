// ============================================================
// ঠাট্টা স্টুডিও — Pose computation (procedural actions)
// Sprint 2: the 12 classic animation principles pass — follow-through,
// overlapping action, secondary motion, squash & stretch, anticipation.
// Every action is a pure function of t — deterministic for scrubbing/export.
// ============================================================

import type { ActionName, EasingName, Pose } from './types';
import { applyExpression } from './expression';

const TAU = Math.PI * 2;

export function basePose(): Pose {
  return {
    xOff: 0,
    yOff: 0,
    bodyLean: 0,
    headTilt: 0,
    headNod: 0,
    shoulderL: 4,
    elbowL: -6,
    shoulderR: 4,
    elbowR: -6,
    hipL: 0,
    kneeL: 0,
    hipR: 0,
    kneeR: 0,
    mouthOpen: 0,
    eyeState: 'open',
    browState: 'normal',
    expression: 'neutral',
    tears: false,
    squash: 0,
  };
}

// ------------------------------------------------------------
// Animation-principle helpers (used throughout the actions below)
// ------------------------------------------------------------

/** damped settle oscillation — follow-through after an impact */
const settle = (k: number, freq = 9, decay = 5): number =>
  Math.exp(-decay * k) * Math.cos(freq * k);

/** phase-lagged sine — overlapping action: a limb trails its parent by `lag` */
const lagSin = (ph: number, lag: number): number => Math.sin(ph - lag);

/** cubic ease-out — fast start, soft landing (extension phase of `reach`) */
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

/**
 * ease with slight overshoot then settle (for point/reach gestures).
 * Returns a 0..1 progress multiplier: races to ~1.08 by `hitAt` seconds,
 * then wobbles back onto the target by `total` seconds (follow-through).
 */
function reach(t: number, hitAt: number, total: number): number {
  if (t <= 0) return 0;
  if (t < hitAt) return 1.08 * easeOutCubic(t / hitAt);
  if (t >= total) return 1;
  return 1 + 0.08 * settle((t - hitAt) / (total - hitAt));
}

/** periodic blink helper (once every ~3.4s) */
function blinking(t: number): boolean {
  return t % 3.4 < 0.12;
}

/**
 * Compute the pose for an action at time `t` (seconds since action start).
 * `speaking` makes the mouth flap (dialogue playing).
 */
export function computePose(action: ActionName, t: number, speaking: boolean): Pose {
  const p = basePose();

  switch (action) {
    case 'idle': {
      // breathing (subtle squash & stretch) + slow weight shift
      p.squash = Math.sin(t * 1.7) * 0.035;
      p.xOff = Math.sin(t * 0.45) * 1.4;
      p.yOff = Math.sin(t * 1.8) * 2;
      // shoulders breathe with a micro phase-lag behind the torso (overlapping)
      p.shoulderL = 4 + Math.sin(t * 1.8 - 0.4) * 3;
      p.shoulderR = 4 + Math.sin(t * 1.8 + 0.6) * 3;
      // head drifts on its own slower rhythm (secondary action)
      p.headTilt = Math.sin(t * 0.9 - 0.3) * 2;
      if (blinking(t)) p.eyeState = 'blink';
      if (speaking) {
        p.mouthOpen = 0.15 + 0.75 * Math.abs(Math.sin(t * 12.5));
        p.shoulderR = 8 + Math.sin(t * 3.2) * 10;
        p.elbowR = -18 + Math.sin(t * 3.2 - 0.55) * 12; // forearm lags upper arm
      }
      p.expression = 'neutral';
      break;
    }
    case 'talk': {
      p.yOff = Math.sin(t * 2.2) * 1.8;
      p.xOff = Math.sin(t * 0.5) * 1.2; // weight shift while chatting
      p.mouthOpen = speaking ? 0.15 + 0.8 * Math.abs(Math.sin(t * 13)) : 0.08;
      // gesture arms: forearms trail the upper arms (overlapping action)
      p.shoulderL = 6 + Math.sin(t * 2.8) * 8;
      p.elbowL = -22 + Math.sin(t * 2.8 - 0.5) * 14;
      p.shoulderR = 8 + Math.sin(t * 3.4) * 12;
      p.elbowR = -26 + Math.sin(t * 3.4 - 0.55) * 16;
      // head nod lags the speech rhythm slightly
      p.headNod = Math.sin(t * 2.6 - 0.7) * 4;
      if (blinking(t)) p.eyeState = 'blink';
      p.expression = 'neutral';
      break;
    }
    case 'walk': {
      const ph = t * TAU * 1.8;
      p.hipL = Math.sin(ph) * 26;
      p.hipR = Math.sin(ph + Math.PI) * 26;
      p.kneeL = Math.max(0, Math.sin(ph + 1.2)) * 30;
      p.kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.2)) * 30;
      // arm swing with follow-through: elbows lag the shoulders by ~0.55 rad
      p.shoulderL = 5 + Math.sin(ph + Math.PI) * 24;
      p.shoulderR = 5 + Math.sin(ph) * 24;
      p.elbowL = -12 + lagSin(ph + Math.PI, 0.55) * 14;
      p.elbowR = -12 + lagSin(ph, 0.55) * 14;
      p.yOff = Math.abs(Math.sin(ph)) * 3.5; // heel-lift bounce
      p.xOff = Math.sin(ph - 0.5) * 1.8; // hip sway trails the feet
      p.bodyLean = 3 + Math.sin(ph) * 1.6; // torso roll
      p.headNod = Math.sin(ph * 2 - 0.55) * 1.8; // counter-bob, delayed
      p.squash = Math.max(0, Math.sin(ph * 2)) * 0.05; // footstrike squash
      p.mouthOpen = speaking ? 0.15 + 0.7 * Math.abs(Math.sin(t * 12)) : 0;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'wave': {
      // forearm whip: elbow trails the shoulder oscillation by ~0.55 rad
      p.shoulderR = 152 + Math.sin(t * 9.5) * 10;
      p.elbowR = -14 + Math.sin(t * 9.5 - 0.55) * 26;
      // body counter-lean absorbs the whip (follow-through)
      p.bodyLean = -Math.sin(t * 9.5) * 2.2;
      p.shoulderL = 5 + Math.sin(t * 1.8) * 2; // other arm relaxed sway
      p.elbowL = -8;
      p.headTilt = Math.sin(t * 4.5) * 5;
      p.yOff = Math.sin(t * 2) * 1.5;
      applyExpression(p, 'smile', 0.75);
      p.mouthOpen = speaking ? 0.2 + 0.7 * Math.abs(Math.sin(t * 12)) : 0;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'laugh': {
      // layered bounce: body leads, shoulders and head follow with delay
      p.yOff = Math.abs(Math.sin(t * 8)) * 7;
      p.shoulderL = 26 + Math.sin(t * 8 - 0.7) * 5;
      p.elbowL = -55;
      p.shoulderR = 26 + Math.sin(t * 8 - 0.7) * 5;
      p.elbowR = -55;
      p.mouthOpen = 0.85 + Math.sin(t * 8) * 0.15;
      p.bodyLean = Math.sin(t * 4) * 3;
      p.headTilt = Math.sin(t * 4 - 0.5) * 11; // head lags the torso
      applyExpression(p, 'laugh', 1); // happy eyes, raised brows, mouth floor
      break;
    }
    case 'point': {
      // overshoot-and-settle: arm snaps out (~0.35s), overshoots, settles
      const ext = reach(t, 0.35, 1.6);
      p.shoulderR = 8 + ext * 80 + Math.sin(t * 2.4) * 2;
      p.elbowR = -4 - ext * 4 + Math.sin(t * 2.4 - 0.4) * 3;
      p.shoulderL = 8;
      p.bodyLean = 5;
      // head leads the gesture slightly, then recovers onto the target
      p.headTilt = 2 + 3 * Math.exp(-t * 2.5);
      p.mouthOpen = speaking ? 0.15 + 0.75 * Math.abs(Math.sin(t * 12.5)) : 0.1;
      p.browState = 'raised';
      p.fist = false; // pointing finger, not a fist
      if (blinking(t)) p.eyeState = 'blink';
      p.expression = 'smile';
      break;
    }
    case 'angry': {
      p.shoulderL = 62;
      p.elbowL = -118;
      p.shoulderR = 62;
      p.elbowR = -118;
      p.yOff = Math.abs(Math.sin(t * 22)) * 1.6;
      p.xOff = Math.sin(t * 34) * 0.5; // trembling fury
      p.headNod = Math.sin(t * 10 - 0.6) * 3; // head shake lags the tremble
      p.mouthOpen = speaking ? 0.2 + 0.65 * Math.abs(Math.sin(t * 14)) : 0.12;
      p.fist = true; // clenched fists
      applyExpression(p, 'angry', 1); // furious face + angerVein + steam
      break;
    }
    case 'jump': {
      const cyc = (t % 1.15) / 1.15;
      // anticipation → launch → air → land (squash & stretch)
      let arc = 0;
      let landK = -1; // >= 0 once the landing follow-through starts
      if (cyc < 0.18) {
        // anticipation crouch
        const k = cyc / 0.18;
        arc = -k * 0.06;
        p.squash = k * 0.7;
      } else if (cyc < 0.78) {
        arc = Math.sin(((cyc - 0.18) / 0.6) * Math.PI);
        p.squash = -0.45 * arc;
        p.fist = true; // fists clenched in the air
      } else {
        // landing impact + a second tiny rebound in the squash
        landK = (cyc - 0.78) / 0.22;
        p.squash =
          Math.sin(landK * Math.PI) * 0.85 +
          0.18 * Math.min(1, landK * 6) * settle(landK, 10, 4);
      }
      p.yOff = Math.max(0, arc) * 58;
      p.hipL = -18 - arc * 16;
      p.hipR = -14 - arc * 14;
      p.kneeL = 20 + arc * 30;
      p.kneeR = 16 + arc * 28;
      if (landK >= 0) {
        // follow-through: arms overshoot downward, then damped settle back up
        const ft = Math.min(1, landK * 5) * settle(landK, 9, 4);
        p.shoulderL = 150 - ft * 36;
        p.shoulderR = 150 - ft * 36;
        p.elbowL = -8 - ft * 14;
        p.elbowR = -8 - ft * 14;
        // head bobs down with a short delay, then recovers
        p.headNod =
          -12 * Math.min(1, Math.max(0, landK - 0.12) * 3) * Math.exp(-landK * 2.5);
      } else {
        p.shoulderL = 150 + arc * 25;
        p.shoulderR = 150 + arc * 25;
        p.elbowL = -8;
        p.elbowR = -8;
      }
      p.expression = 'smile';
      p.mouthOpen = 0.35 + arc * 0.4;
      p.eyeState = 'wide';
      p.browState = 'raised';
      break;
    }
    case 'nod': {
      // overlapping body: torso pitch trails the head nod by ~0.12s
      p.headNod = Math.sin(t * 6.5) * 15;
      p.bodyLean = Math.sin(t * 6.5 - 0.75) * 3;
      p.yOff = Math.sin(t * 2) * 1.5;
      p.shoulderL = 4; // shoulders stay relaxed
      p.shoulderR = 4;
      p.mouthOpen = speaking ? 0.15 + 0.6 * Math.abs(Math.sin(t * 11)) : 0.1;
      p.expression = 'smile';
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'cry': {
      // heaving sob: body heaves, shoulders hug with a delay (overlapping)
      p.yOff = Math.abs(Math.sin(t * 3.2)) * 5;
      p.headTilt = Math.sin(t * 3.2 - 0.4) * 6;
      p.shoulderL = 70 + Math.sin(t * 3.2 - 0.5) * 7;
      p.elbowL = -95;
      p.shoulderR = 70 + Math.sin(t * 3.2 - 0.9) * 7;
      p.elbowR = -95;
      p.mouthOpen = 0.3 + 0.25 * Math.abs(Math.sin(t * 7));
      applyExpression(p, 'cry'); // closed eyes, sad brows, tears, mouth floor
      break;
    }
    case 'run': {
      const ph = t * TAU * 3.1;
      p.hipL = Math.sin(ph) * 42;
      p.hipR = Math.sin(ph + Math.PI) * 42;
      p.kneeL = Math.max(0, Math.sin(ph + 1.1)) * 55;
      p.kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.1)) * 55;
      // big arm swing, elbows trailing by ~0.6 rad (overlapping action)
      p.shoulderL = 8 + Math.sin(ph + Math.PI) * 42;
      p.shoulderR = 8 + Math.sin(ph) * 42;
      p.elbowL = -68 + lagSin(ph + Math.PI, 0.6) * 12;
      p.elbowR = -68 + lagSin(ph, 0.6) * 12;
      p.yOff = Math.abs(Math.sin(ph)) * 7; // strong flight bounce
      p.xOff = Math.sin(ph - 0.5) * 2.4; // sway trails the feet
      p.bodyLean = 10 + Math.sin(ph) * 2.5; // forward lean pulses with stride
      p.headNod = Math.sin(ph * 2 - 0.55) * 2.8; // delayed counter-bob
      p.fist = true; // sprinting fists
      p.expression = 'neutral';
      p.mouthOpen = speaking ? 0.2 + 0.7 * Math.abs(Math.sin(t * 12)) : 0.18;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'slap': {
      // 1.1s cycle: windup → whoosh → follow-through settle
      const cyc = (t % 1.1) / 1.1;
      let swing: number;
      let elbow: number;
      if (cyc < 0.42) {
        // anticipation: arm winds back
        const k = cyc / 0.42;
        swing = -k * 46;
        elbow = -k * 66;
        p.bodyLean = -k * 7;
      } else if (cyc < 0.62) {
        // fast strike
        const k = (cyc - 0.42) / 0.2;
        swing = -46 + k * 190;
        elbow = -66 + k * 58;
        p.bodyLean = -7 + k * 16;
        p.squash = Math.sin(k * Math.PI) * 0.3;
      } else {
        // follow-through: damped settle instead of a static hold
        const k = (cyc - 0.62) / 0.38;
        const ramp = Math.min(1, k * 8);
        swing = 144 * (1 - k * 0.25) + ramp * settle(k, 11, 4.5) * 9;
        elbow = -8 + ramp * settle(Math.max(0, k - 0.06) / 0.94, 11, 4.5) * 6;
        p.bodyLean = 9 * (1 - k * 0.4);
      }
      p.shoulderR = 62 + swing;
      p.elbowR = elbow;
      p.shoulderL = -14;
      p.elbowL = -34;
      // head: shake during windup/strike, recoil snap with delay on impact
      if (cyc < 0.62) {
        p.headNod = Math.sin(cyc * 18) * 3;
      } else {
        const k = (cyc - 0.62) / 0.38;
        const ramp = Math.min(1, k * 12);
        p.headNod = ramp * (-4 * Math.exp(-k * 3.2) + 3 * settle(k, 12, 5));
      }
      p.browState = 'angry';
      p.expression = 'angry';
      p.eyeState = 'wide';
      p.fist = true; // clenched fist
      p.mouthOpen = speaking ? 0.25 + 0.6 * Math.abs(Math.sin(t * 13)) : 0.2;
      break;
    }
    case 'bow': {
      const cyc = (t % 2.4) / 2.4;
      // anticipation: a tiny rise before folding down (first 8%)
      const antic = cyc < 0.08 ? Math.sin((cyc / 0.08) * Math.PI) * 2 : 0;
      // soft settle wobble around the deep point of the bow
      const wob =
        cyc > 0.31
          ? settle((cyc - 0.31) / 0.45, 6, 3) * 2.6 * Math.min(1, (cyc - 0.31) * 12)
          : 0;
      // lean down, hold with the wobble, rise
      const lean = Math.sin(Math.min(1, cyc * 1.6) * Math.PI) * 34 + wob;
      p.bodyLean = lean;
      p.headNod = lean * 0.55;
      p.shoulderL = 18 + lean * 1.1;
      p.shoulderR = 18 + lean * 1.1;
      p.elbowL = -58 - lean * 0.5;
      p.elbowR = -58 - lean * 0.5;
      p.yOff = antic - lean * 0.35;
      p.expression = 'smile';
      p.mouthOpen = speaking ? 0.15 + 0.6 * Math.abs(Math.sin(t * 12)) : 0.08;
      // eyes close at the full depth of the bow (respect)
      if (lean > 26) p.eyeState = 'closed';
      else if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'think': {
      // head-scratch secondary action: forearm draws small slow circles
      p.headTilt = 9 + Math.sin(t * 1.6) * 2.5;
      p.shoulderR = 34 + Math.sin(t * 2.2 - 1.1) * 3; // slight counter to elbow
      p.elbowR = -122 + Math.sin(t * 2.2) * 6;
      p.shoulderL = 6;
      p.elbowL = -10;
      p.yOff = Math.sin(t * 1.9) * 1.6;
      p.browState = 'raised';
      p.expression = 'neutral';
      p.mouthOpen = speaking ? 0.12 + 0.55 * Math.abs(Math.sin(t * 11)) : 0.06;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'surprise': {
      const cyc = (t % 1.6) / 1.6;
      const jolt = Math.exp(-cyc * 5) * Math.sin(cyc * 22);
      // a soft settle wobble rides in after the initial jolt
      const wob = Math.min(1, cyc * 12) * settle(cyc, 8, 3.2) * 3.2;
      p.yOff = Math.max(0, jolt) * 26 + wob;
      p.squash = -Math.max(0, jolt) * 0.35;
      // arms overshoot upward, then settle with the wobble
      const armWob = Math.min(1, cyc * 10) * settle(cyc, 9, 3.5) * 8;
      p.shoulderL = 148 + jolt * 18 + armWob;
      p.shoulderR = 148 + jolt * 18 + armWob;
      p.elbowL = -12;
      p.elbowR = -12;
      p.headTilt = jolt * 6;
      p.mouthOpen = 0.55 + Math.abs(jolt) * 0.3;
      applyExpression(p, 'surprised'); // wide eyes + shockLines FX
      break;
    }
    case 'dance': {
      const ph = t * TAU * 1.35; // body rhythm 1.35 Hz
      const armPh = ph - 0.35; // arms lag the body (overlapping action)
      p.xOff = Math.sin(ph) * 6;
      p.yOff = Math.abs(Math.sin(ph * 2)) * 4.5;
      p.bodyLean = Math.sin(ph) * 7;
      p.headTilt = Math.sin(ph - 0.8) * 9; // head lags even more
      p.headNod = Math.sin(ph * 2 - 0.5) * 3;
      p.shoulderL = 60 + Math.sin(armPh) * 95;
      p.shoulderR = 60 - Math.sin(armPh) * 95;
      p.elbowL = -34 + Math.cos(armPh - 0.35) * 22;
      p.elbowR = -34 - Math.cos(armPh - 0.35) * 22;
      // feet: hips alternate, knees bounce on the double beat
      p.hipL = Math.sin(ph) * 14;
      p.hipR = Math.sin(ph + Math.PI) * 14;
      p.kneeL = Math.max(0, Math.sin(ph * 2 - 0.4)) * 16;
      p.kneeR = Math.max(0, Math.sin(ph * 2 - 0.4 + Math.PI)) * 16;
      p.eyeState = 'happy';
      p.browState = 'raised';
      p.expression = 'laugh';
      p.fx = ['music'];
      p.mouthOpen = 0.45 + Math.abs(Math.sin(ph * 2)) * 0.3;
      break;
    }
    case 'fall': {
      // comedic stumble-back cycle: windmill wobble → tip → sit → recover
      const cyc = (t % 2.2) / 2.2;
      if (cyc < 0.3) {
        const k = cyc / 0.3;
        p.bodyLean = -k * 16;
        // bigger anticipation: panic windmill, shoulders rotate full-ish circles
        p.shoulderL = 40 + k * 50 + Math.sin(t * 18) * 35;
        p.shoulderR = 40 + k * 50 + Math.sin(t * 18 + Math.PI) * 35;
        p.elbowL = -100 + Math.sin(t * 18 - 0.5) * 12;
        p.elbowR = -100 + Math.sin(t * 18 - 0.5 + Math.PI) * 12;
        p.eyeState = 'wide';
      } else if (cyc < 0.55) {
        const k = (cyc - 0.3) / 0.25;
        p.bodyLean = -16 - k * 58;
        p.yOff = -k * 34;
        // arms flail with lag while tipping over
        p.shoulderL = 90 + k * 80 + Math.sin(t * 18 - 0.4) * 18;
        p.shoulderR = 90 + k * 80 + Math.sin(t * 18 - 0.9) * 18;
        p.elbowL = -60 + Math.sin(t * 18 - 0.6) * 20;
        p.elbowR = -60 + Math.sin(t * 18 - 1.1) * 20;
        p.hipL = -30 * k;
        p.hipR = -26 * k;
        p.kneeL = 40 * k;
        p.kneeR = 34 * k;
        p.expression = 'surprised';
        p.browState = 'raised';
        p.eyeState = 'wide';
        p.mouthOpen = 0.7;
      } else if (cyc < 0.85) {
        // sitting on ground
        p.bodyLean = -74;
        p.yOff = -34;
        p.shoulderL = 150;
        p.shoulderR = 150;
        p.elbowL = -40;
        p.elbowR = -40;
        p.hipL = -58;
        p.hipR = -52;
        p.kneeL = 58;
        p.kneeR = 50;
        p.expression = 'surprised';
        p.browState = 'raised';
        p.mouthOpen = 0.5;
        p.tears = false;
      } else {
        const k = (cyc - 0.85) / 0.15;
        // recovery with a soft settle wobble (follow-through)
        const wob = Math.min(1, k * 4) * settle(k, 9, 3.5) * 6;
        p.bodyLean = -74 * (1 - k) + wob * 0.4;
        p.yOff = -34 * (1 - k);
        p.shoulderL = 150 - k * 120 + wob;
        p.shoulderR = 150 - k * 120 + wob;
        p.elbowL = -40 + k * 20;
        p.elbowR = -40 + k * 20;
        p.hipL = -58 * (1 - k);
        p.hipR = -52 * (1 - k);
        p.kneeL = 58 * (1 - k);
        p.kneeR = 50 * (1 - k);
        p.expression = 'frown';
        p.browState = 'sad';
      }
      break;
    }
    case 'push': {
      const ph = Math.sin(t * 5.2);
      // strain: body leads, elbows follow with a 0.4 rad lag
      p.bodyLean = 12 + ph * 3;
      p.shoulderL = 84 + Math.sin(t * 5.2 - 0.2) * 8;
      p.shoulderR = 84 + Math.sin(t * 5.2 - 0.2) * 8;
      p.elbowL = -16 - Math.sin(t * 5.2 - 0.4) * 10;
      p.elbowR = -16 - Math.sin(t * 5.2 - 0.4) * 10;
      // legs drive alternately
      p.hipL = -12 + Math.sin(t * 5.2) * 8;
      p.hipR = 8 - Math.sin(t * 5.2) * 8;
      p.kneeL = 14 - Math.sin(t * 5.2) * 4;
      p.kneeR = 6 + Math.sin(t * 5.2) * 4;
      p.yOff = Math.abs(ph) * 1.6;
      p.fist = true; // gripping hard
      p.fx = t > 1 ? ['sweat'] : []; // strain sweat kicks in after a second
      p.expression = 'neutral';
      p.mouthOpen = speaking ? 0.2 + 0.6 * Math.abs(Math.sin(t * 12)) : 0.15;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    default: {
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
  }

  return p;
}

export function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Movement-quality easings for beat paths (walk/run targets). */
export function easingByName(name: EasingName): (x: number) => number {
  switch (name) {
    case 'linear':
      return (x) => x;
    case 'easeIn':
      return (x) => x * x;
    case 'easeOut':
      return (x) => 1 - (1 - x) * (1 - x);
    case 'backOut':
      return (x) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };
    case 'elasticOut':
      return (x) => {
        if (x === 0 || x === 1) return x;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
      };
    case 'easeInOut':
    default:
      return easeInOut;
  }
}
