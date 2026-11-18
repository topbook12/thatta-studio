// ============================================================
// ঠাট্টা স্টুডিও — Pose computation (procedural actions)
// Sprint 2: the 12 classic animation principles pass — follow-through,
// overlapping action, secondary motion, squash & stretch, anticipation.
// Every action is a pure function of t — deterministic for scrubbing/export.
// ============================================================

import type { ActionName, EasingName, Pose, PoseOffset } from './types';
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
    mouthWide: 0,
    eyeState: 'open',
    browState: 'normal',
    expression: 'neutral',
    tears: false,
    squash: 0,
    clothSway: 0,
    hairSway: 0,
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
      // Sprint 8 — the head counters the torso roll a beat later and tilts
      // with it (the gaze stays level — real walking balance)
      p.headNod = Math.sin(ph * 2 - 0.55) * 1.8; // counter-bob, delayed
      p.headTilt = Math.sin(ph + 0.85) * -1.6;
      p.squash = Math.max(0, Math.sin(ph * 2)) * 0.05; // footstrike squash
      // Sprint 9 — the lungi hem trails the stride a beat late (cloth inertia)
      p.clothSway = Math.sin(ph - 0.95) * 4.5;
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
      p.clothSway = Math.sin(ph - 0.95) * 7.5; // hem whips behind the sprint
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
      p.clothSway = Math.sin(ph - 0.55) * 6; // skirt/lungi swirl trails the hips
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
    case 'kick': {
      // 1.3s cycle: knee windup → leg whip → settle (Gopal-style comedy kick)
      const cyc = (t % 1.3) / 1.3;
      let hip: number;
      let knee: number;
      let lean: number;
      if (cyc < 0.34) {
        // anticipation: knee lifts, torso counter-leans back
        const k = cyc / 0.34;
        hip = -k * 40;
        knee = 18 + k * 62;
        lean = -k * 8;
      } else if (cyc < 0.56) {
        // fast leg whip out
        const k = (cyc - 0.34) / 0.22;
        hip = -40 + k * 118;
        knee = 80 - k * 74;
        lean = -8 + k * 18;
        p.squash = Math.sin(k * Math.PI) * 0.22;
      } else {
        // follow-through: damped leg return
        const k = (cyc - 0.56) / 0.44;
        const wob = Math.min(1, k * 6) * settle(k, 10, 4.2) * 7;
        hip = 78 * (1 - k) + wob;
        knee = 6 + (1 - k) * 8;
        lean = 10 * (1 - k);
      }
      p.hipR = hip;
      p.kneeR = knee;
      // supporting leg absorbs the impact
      p.hipL = -6 + Math.sin(cyc * Math.PI) * 5;
      p.kneeL = 10 + Math.sin(cyc * Math.PI) * 8;
      // arms windmill opposite the leg for balance
      p.shoulderL = 20 - hip * 0.7 + Math.sin(t * 9) * 4;
      p.elbowL = -30;
      p.shoulderR = 30 + hip * 0.5;
      p.elbowR = -50;
      p.bodyLean = lean;
      p.yOff = Math.sin(cyc * Math.PI) * 3;
      p.fist = true;
      p.expression = 'angry';
      p.browState = 'angry';
      p.mouthOpen = speaking ? 0.25 + 0.6 * Math.abs(Math.sin(t * 13)) : 0.3;
      break;
    }
    case 'shiver': {
      // frightened trembling: high-freq jitter + chattering teeth
      const j = Math.sin(t * 26) * 1.6;
      p.xOff = j;
      p.yOff = Math.abs(Math.sin(t * 22)) * 1.2;
      p.bodyLean = -4 + Math.sin(t * 17) * 1.6; // cowering back
      p.headTilt = Math.sin(t * 21 - 0.3) * 3.5; // head trails the shake
      // arms hug the body, hands trembling
      p.shoulderL = 46 + Math.sin(t * 24) * 3;
      p.elbowL = -108 + Math.sin(t * 24 - 0.5) * 4;
      p.shoulderR = 46 + Math.sin(t * 24 + 1.4) * 3;
      p.elbowR = -108 + Math.sin(t * 24 + 0.9) * 4;
      p.kneeL = 8;
      p.kneeR = 6; // knees knocking
      p.mouthOpen = 0.1 + Math.abs(Math.sin(t * 21)) * 0.14; // b-b-b-chat chatter
      p.eyeState = 'wide';
      p.browState = 'sad';
      p.expression = 'frown';
      p.fx = ['sweat']; // ঘাম — ভয়ে
      break;
    }
    case 'eat': {
      // delight-eating cycle: hand to mouth, chewing with a happy cheeks bounce
      const cyc = (t % 1.5) / 1.5;
      const bite = cyc < 0.38 ? Math.sin((cyc / 0.38) * Math.PI) : 0;
      // near hand carries the bite up to the mouth
      p.shoulderR = 10 + bite * 96;
      p.elbowR = -10 - bite * 92;
      p.shoulderL = 8 + Math.sin(t * 2.1) * 4;
      p.elbowL = -12;
      // chewing: mouth flaps after every bite
      const chew = cyc > 0.42 ? Math.abs(Math.sin(t * 11)) : 0;
      p.mouthOpen = Math.max(bite * 0.5, chew * 0.42);
      p.mouthWide = 0.35 + chew * 0.3; // cheeks puffed wide
      p.headNod = bite * -6 + chew * 1.4; // head dips toward the hand
      p.yOff = Math.sin(t * 2.3) * 1.4;
      p.squash = chew * 0.05;
      p.expression = 'laugh'; // happy eyes + raised brows — মিষ্টি মজা!
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'sleep': {
      // deep sleep: slow breathing, head droops, zzz FX float up
      const br = Math.sin(t * 1.15);
      p.squash = br * 0.055; // slow deep breathing
      p.yOff = br * 1.6;
      p.headNod = 16 + br * 4; // head drooped forward
      p.headTilt = 7 + Math.sin(t * 0.5) * 2;
      p.bodyLean = 6 + br * 1.2;
      p.shoulderL = 10 + br * 3;
      p.shoulderR = 10 + br * 3;
      p.elbowL = -4;
      p.elbowR = -4;
      p.kneeL = 4;
      p.kneeR = 4;
      p.eyeState = 'closed';
      p.browState = 'normal';
      p.expression = 'neutral';
      p.mouthOpen = 0.06 + Math.max(0, br) * 0.06; // snore mouth
      p.fx = ['zzz']; // 💤
      break;
    }
    case 'celebrate': {
      // জয়ধোঁয়া! — fist-pump hops with layered follow-through
      const cyc = (t % 1.6) / 1.6;
      const hop = Math.sin(Math.min(1, cyc * 2.1) * Math.PI); // 0..1..0
      p.yOff = hop * 26;
      p.squash = -hop * 0.3 + (cyc > 0.55 ? Math.sin(((cyc - 0.55) / 0.45) * Math.PI) * 0.35 : 0);
      // arms pump up, elbows trailing (overlapping action)
      p.shoulderL = 150 - hop * 34 + Math.sin(t * 13) * 5;
      p.shoulderR = 150 - hop * 34 - Math.sin(t * 13) * 5;
      p.elbowL = -6 + Math.sin(t * 13 - 0.5) * 10;
      p.elbowR = -6 - Math.sin(t * 13 - 0.5) * 10;
      p.fist = true; // জয়ের মুষ্টি!
      p.hipL = -8 - hop * 12;
      p.hipR = -4 - hop * 10;
      p.kneeL = 12 + hop * 18;
      p.kneeR = 8 + hop * 14;
      p.headTilt = Math.sin(t * 6.5) * 4;
      p.headNod = -hop * 7; // face up to the sky
      p.eyeState = 'happy';
      p.browState = 'raised';
      p.expression = 'laugh';
      p.mouthOpen = 0.55 + hop * 0.3; // “জয় গোপাল!”
      p.mouthWide = 0.5;
      break;
    }
    case 'sneak': {
      // টিপটো — hunched tiptoe walk, exaggerated slow swing, guilty look
      const ph = t * TAU * 0.9; // slow careful steps
      p.hipL = Math.sin(ph) * 17;
      p.hipR = Math.sin(ph + Math.PI) * 17;
      p.kneeL = Math.max(0, Math.sin(ph + 1.3)) * 26;
      p.kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.3)) * 26;
      p.yOff = 4 + Math.abs(Math.sin(ph)) * 2.6; // on tiptoes
      p.bodyLean = 13 + Math.sin(ph) * 1.5; // hunched forward
      p.headNod = 9 + Math.sin(ph * 2 - 0.5) * 2.4; // head craned ahead
      p.headTilt = Math.sin(t * 1.2) * 3; // checking around
      // arms tucked, hands dangling like a cartoon burglar
      p.shoulderL = 38 + Math.sin(ph + Math.PI) * 9;
      p.shoulderR = 38 + Math.sin(ph) * 9;
      p.elbowL = -92 + lagSin(ph + Math.PI, 0.5) * 7;
      p.elbowR = -92 + lagSin(ph, 0.5) * 7;
      p.clothSway = Math.sin(ph - 0.9) * 2.6; // careful cloth drifts too
      p.eyeState = 'wide';
      p.browState = 'raised';
      p.expression = 'frown';
      p.mouthOpen = speaking ? 0.1 + 0.4 * Math.abs(Math.sin(t * 9)) : 0.05;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'carry': {
      // মাথায় বোঝা — heavy load balanced overhead: slow deliberate stride,
      // knees always loaded, torso counter-leans back under the weight,
      // arms locked up (trembling slightly with each footstep).
      const ph = t * TAU * 0.95; // heavy steps are slow
      const step = Math.sin(ph);
      p.hipL = step * 20;
      p.hipR = Math.sin(ph + Math.PI) * 20;
      p.kneeL = 10 + Math.max(0, Math.sin(ph + 1.3)) * 22;
      p.kneeR = 10 + Math.max(0, Math.sin(ph + Math.PI + 1.3)) * 22;
      // the torso pitches back to counterbalance, rolling with each step
      p.bodyLean = -4 + Math.sin(ph) * 1.8;
      p.yOff = -3 + Math.abs(Math.sin(ph)) * 2.2; // loaded crouch
      p.squash = Math.max(0, Math.sin(ph * 2)) * 0.06; // footstrike thud
      p.xOff = Math.sin(ph - 0.5) * 1.6;
      // arms lock overhead, elbows micro-lag (weight settling on the palms)
      p.shoulderL = 158 + Math.sin(ph - 0.4) * 5;
      p.shoulderR = 158 + Math.sin(ph + 0.3) * 5;
      p.elbowL = -22 + Math.sin(ph - 0.75) * 4;
      p.elbowR = -22 + Math.sin(ph + 0.65) * 4;
      // head tucks slightly forward, gaze steady under the load
      p.headNod = 8 + Math.sin(ph * 2 - 0.5) * 1.6;
      p.headTilt = Math.sin(ph + 0.9) * -1.4;
      p.clothSway = Math.sin(ph - 1.0) * 4; // heavy cloth swings slow & late
      p.fist = true; // gripping the load
      p.mouthOpen = speaking ? 0.15 + 0.5 * Math.abs(Math.sin(t * 11)) : 0.1;
      p.expression = 'neutral';
      p.browState = 'normal';
      if (t > 1.2) p.fx = ['sweat']; // ঘাম — ভারী বোঝা
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'clap': {
      // হাত তালি — enthusiastic applause: hands meet at the chest on a fast
      // cycle, impact squash on contact, elbows trail, body bounces lightly.
      const cyc = (t % 0.55) / 0.55;
      // 0..1..0 approach curve — arms converge then spring apart a touch
      const meet = Math.abs(Math.sin(cyc * Math.PI));
      const imp = Math.exp(-cyc * 6); // impact ring-out after contact
      p.shoulderL = 46 + meet * 44 - imp * 3;
      p.shoulderR = 46 + meet * 44 - imp * 3;
      p.elbowL = -92 + meet * 34 + Math.sin(cyc * Math.PI - 0.4) * 5;
      p.elbowR = -92 + meet * 34 - Math.sin(cyc * Math.PI - 0.4) * 5;
      // torso absorbs each clap with a tiny delayed bounce (overlapping)
      p.yOff = imp * 2.2 + Math.sin(t * 2.1) * 1.2;
      p.squash = imp * 0.05;
      p.bodyLean = Math.sin(t * 2.1) * 1.5;
      p.headTilt = Math.sin(t * 2.1 - 0.4) * 3;
      p.headNod = imp * 1.5;
      p.eyeState = 'happy';
      p.browState = 'raised';
      p.expression = 'laugh';
      p.mouthOpen = speaking ? 0.3 + 0.55 * Math.abs(Math.sin(t * 12)) : 0.4;
      p.mouthWide = 0.45;
      break;
    }
    case 'salute': {
      // স্যালুট — crisp military salute: snap up with overshoot, hold with
      // a proud micro-tremble, chest out, far arm snapped straight down.
      const cyc = t % 2.2;
      let raise: number;
      if (cyc < 0.35) raise = reach(cyc, 0.35, 0.7); // snap up + overshoot
      else if (cyc < 1.8) raise = 1; // proud hold
      else raise = 1 - (cyc - 1.8) / 0.4; // lower with a soft settle
      const hold = Math.sin(t * 13) * 0.8; // proud tremble during the hold
      p.shoulderR = 10 + raise * 118 + hold * raise;
      p.elbowR = -10 + raise * -122 + hold * raise * 0.6; // hand to the brow
      p.shoulderL = -2; // far arm snaps straight down at attention
      p.elbowL = -2;
      p.bodyLean = raise * 2.5; // chest out
      p.headNod = raise * -3; // chin up
      p.headTilt = raise * 1.5;
      p.yOff = raise * 1.5;
      p.expression = 'neutral';
      p.mouthOpen = speaking ? 0.15 + 0.6 * Math.abs(Math.sin(t * 12)) : 0.05;
      p.browState = 'normal';
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'turn': {
      // ঘুরে দাঁড়াচ্ছে — anticipation → pivot → settle. The engine squashes
      // the sprite through zero width and swaps facing at the midpoint; this
      // pose adds the body language: weight shift back, head leading the
      // spin, heel lifting through the pivot, arms opening for balance.
      const c = Math.min(1, t / 1.4);
      const wind = Math.min(1, c / 0.3); // anticipation phase 0..1
      const post = Math.max(0, (c - 0.5) / 0.5); // settle phase 0..1
      p.xOff = -Math.sin(wind * Math.PI) * 5 + Math.sin(post * Math.PI) * 4;
      p.bodyLean = -Math.sin(wind * Math.PI) * 6 + Math.sin(post * Math.PI) * 5;
      // head turns AGAINST the spin first, then snaps with it (lead & follow)
      p.headTilt = -Math.sin(wind * Math.PI) * 10 + Math.sin(Math.max(0, post - 0.15) * Math.PI) * 8;
      p.yOff = Math.sin(Math.min(1, c / 0.5) * Math.PI) * 4; // heel lift at pivot
      p.shoulderL = 6 + wind * 16 - post * 10;
      p.shoulderR = 6 + wind * 14 - post * 8;
      p.elbowL = -10 - wind * 22 + post * 16;
      p.elbowR = -10 - wind * 18 + post * 12;
      p.squash = (1 - Math.abs(1 - 2 * c)) * 0.12; // compress through the pivot
      p.headNod = Math.sin(c * Math.PI) * 4;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    default: {
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
  }

  // ------------------------------------------------------------
  // Sprint 8 — universal finishing pass: nothing alive is perfectly
  // still. Every grounded action breathes: a slow body sway, a slower
  // counter-swaying head, shoulders riding the breath. Subtle enough
  // to never fight the choreography, present enough to remove the
  // “frozen puppet” feel on long holds. (sleep/fall/turn excluded —
  // they have their own full-body rhythms.)
  // ------------------------------------------------------------
  if (action !== 'sleep' && action !== 'fall' && action !== 'turn') {
    const sway = Math.sin(t * 0.7 + 0.4);
    p.bodyLean += sway * 0.7;
    p.headTilt += Math.sin(t * 0.7 - 0.35) * 0.9;
    p.shoulderL += sway * 1.1;
    p.shoulderR += sway * 1.1;
    // Sprint 9 — cloth never freezes either: a faint breeze ripple rides
    // every grounded action (walk/run/dance/carry set stronger strides above)
    p.clothSway += Math.sin(t * 1.1 + 0.8) * 0.9;
  }

  // Sprint 9 — hair follow-through (ALL actions): the tips of long hair
  // answer every head move a beat later and keep their own slow swing.
  p.hairSway = -p.headTilt * 0.45 + Math.sin(t * 1.3 - 0.5) * 1.4;

  return p;
}

export function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Phase 3 — CSS-style cubic-bezier easing solver (P0=(0,0), P3=(1,1),
 * control points (x1,y1),(x2,y2)). Binary search on the curve parameter
 * keeps it deterministic and fast enough for per-frame use.
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const bez = (t: number, a: number, b: number) =>
    3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  const solveT = (x: number): number => {
    // find t where bezX(t) === x (bezX is monotonic for 0<=x1,x2<=1)
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return bez(solveT(x), y1, y2);
  };
}

/** Movement-quality easings for beat paths (walk/run targets). */
export function easingByName(
  name: EasingName,
  custom?: [number, number, number, number],
): (x: number) => number {
  if (name === 'custom' && custom && custom.length === 4) {
    return cubicBezierEase(custom[0], custom[1], custom[2], custom[3]);
  }
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
    case 'custom':
      // no control points persisted → behave like smooth easeInOut
      return easeInOut;
    case 'easeInOut':
    default:
      return easeInOut;
  }
}

// ---------------- Phase 3: pose blending ----------------

/**
 * Blend a secondary action's pose OVER the primary one (k = how much of
 * the secondary shows, 0..1). The FACE (eyes/brows/expression/tears)
 * always stays with the primary action, and lip-sync drives the mouth
 * afterwards anyway — blending only shapes body/limbs/motion.
 */
export function blendPoses(primary: Pose, secondary: Pose, k: number): Pose {
  const L = (a: number, b: number) => a + (b - a) * k;
  return {
    ...primary,
    xOff: L(primary.xOff, secondary.xOff),
    yOff: L(primary.yOff, secondary.yOff),
    bodyLean: L(primary.bodyLean, secondary.bodyLean),
    headTilt: L(primary.headTilt, secondary.headTilt),
    headNod: L(primary.headNod, secondary.headNod),
    shoulderL: L(primary.shoulderL, secondary.shoulderL),
    elbowL: L(primary.elbowL, secondary.elbowL),
    shoulderR: L(primary.shoulderR, secondary.shoulderR),
    elbowR: L(primary.elbowR, secondary.elbowR),
    hipL: L(primary.hipL, secondary.hipL),
    kneeL: L(primary.kneeL, secondary.kneeL),
    hipR: L(primary.hipR, secondary.hipR),
    kneeR: L(primary.kneeR, secondary.kneeR),
    mouthOpen: Math.max(primary.mouthOpen, secondary.mouthOpen * 0.45),
    squash: L(primary.squash, secondary.squash),
    clothSway: L(primary.clothSway, secondary.clothSway),
    hairSway: L(primary.hairSway, secondary.hairSway),
  };
}

/**
 * Phase 3 — apply the pose editor's hand offsets on top of a computed
 * pose (additive; clamped ranges are enforced at save time).
 */
export function applyPoseOffsets(p: Pose, po: PoseOffset | undefined): Pose {
  if (!po) return p;
  return {
    ...p,
    bodyLean: p.bodyLean + (po.bodyLean ?? 0),
    headTilt: p.headTilt + (po.headTilt ?? 0),
    shoulderR: p.shoulderR + (po.shoulderR ?? 0),
    elbowR: p.elbowR + (po.elbowR ?? 0),
    shoulderL: p.shoulderL + (po.shoulderL ?? 0),
    elbowL: p.elbowL + (po.elbowL ?? 0),
    yOff: p.yOff + (po.yOff ?? 0),
  };
}
