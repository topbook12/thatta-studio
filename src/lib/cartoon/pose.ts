// ============================================================
// ঠাট্টা স্টুডিও — Pose computation (procedural actions)
// ============================================================

import type { ActionName, EasingName, Pose } from './types';

const D = Math.PI / 180;

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

const TAU = Math.PI * 2;

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
      p.yOff = Math.sin(t * 1.8) * 2;
      p.shoulderL = 4 + Math.sin(t * 1.8) * 3;
      p.shoulderR = 4 + Math.sin(t * 1.8 + 0.6) * 3;
      p.headTilt = Math.sin(t * 0.9) * 2;
      if (blinking(t)) p.eyeState = 'blink';
      if (speaking) {
        p.mouthOpen = 0.15 + 0.75 * Math.abs(Math.sin(t * 12.5));
        p.shoulderR = 8 + Math.sin(t * 3.2) * 10;
        p.elbowR = -18 + Math.sin(t * 3.2) * 12;
      }
      p.expression = 'neutral';
      break;
    }
    case 'talk': {
      p.yOff = Math.sin(t * 2.2) * 1.8;
      p.mouthOpen = speaking ? 0.15 + 0.8 * Math.abs(Math.sin(t * 13)) : 0.08;
      p.shoulderL = 6 + Math.sin(t * 2.8) * 8;
      p.elbowL = -22 + Math.sin(t * 2.8 + 1) * 14;
      p.shoulderR = 8 + Math.sin(t * 3.4) * 12;
      p.elbowR = -26 + Math.sin(t * 3.4) * 16;
      p.headNod = Math.sin(t * 2.6) * 4;
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
      p.shoulderL = 5 + Math.sin(ph + Math.PI) * 24;
      p.shoulderR = 5 + Math.sin(ph) * 24;
      p.elbowL = -12;
      p.elbowR = -12;
      p.yOff = Math.abs(Math.sin(ph)) * 3.5;
      p.xOff = Math.sin(ph) * 1.5; // hip sway
      p.bodyLean = 3;
      p.headNod = Math.sin(ph * 2) * 1.6; // counter-bob
      p.mouthOpen = speaking ? 0.15 + 0.7 * Math.abs(Math.sin(t * 12)) : 0;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'wave': {
      p.shoulderR = 152 + Math.sin(t * 9.5) * 10;
      p.elbowR = -14 + Math.sin(t * 9.5 + 0.8) * 26;
      p.shoulderL = 5;
      p.headTilt = Math.sin(t * 4.5) * 5;
      p.yOff = Math.sin(t * 2) * 1.5;
      p.expression = 'smile';
      p.mouthOpen = speaking ? 0.2 + 0.7 * Math.abs(Math.sin(t * 12)) : 0;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'laugh': {
      p.yOff = Math.abs(Math.sin(t * 8)) * 7;
      p.headTilt = Math.sin(t * 4) * 11;
      p.shoulderL = 26;
      p.elbowL = -55;
      p.shoulderR = 26;
      p.elbowR = -55;
      p.mouthOpen = 0.85 + Math.sin(t * 8) * 0.15;
      p.eyeState = 'happy';
      p.browState = 'raised';
      p.expression = 'laugh';
      p.bodyLean = Math.sin(t * 4) * 3;
      break;
    }
    case 'point': {
      p.shoulderR = 88 + Math.sin(t * 2.4) * 3;
      p.elbowR = -6 + Math.sin(t * 2.4) * 4;
      p.shoulderL = 8;
      p.bodyLean = 5;
      p.headTilt = 2;
      p.mouthOpen = speaking ? 0.15 + 0.75 * Math.abs(Math.sin(t * 12.5)) : 0.1;
      p.browState = 'raised';
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
      p.headNod = Math.sin(t * 10) * 3;
      p.browState = 'angry';
      p.expression = 'angry';
      p.mouthOpen = speaking ? 0.2 + 0.65 * Math.abs(Math.sin(t * 14)) : 0.12;
      p.eyeState = 'wide';
      break;
    }
    case 'jump': {
      const cyc = (t % 1.15) / 1.15;
      // anticipation → launch → air → land (squash & stretch)
      let arc: number;
      if (cyc < 0.18) {
        // anticipation crouch
        const k = cyc / 0.18;
        arc = -k * 0.06;
        p.squash = k * 0.7;
      } else if (cyc < 0.78) {
        arc = Math.sin(((cyc - 0.18) / 0.6) * Math.PI);
        p.squash = -0.45 * Math.sin(((cyc - 0.18) / 0.6) * Math.PI);
      } else {
        // landing impact
        const k = (cyc - 0.78) / 0.22;
        arc = 0;
        p.squash = Math.sin(k * Math.PI) * 0.85;
      }
      p.yOff = Math.max(0, arc) * 58;
      p.hipL = -18 - arc * 16;
      p.hipR = -14 - arc * 14;
      p.kneeL = 20 + arc * 30;
      p.kneeR = 16 + arc * 28;
      p.shoulderL = 150 + arc * 25;
      p.shoulderR = 150 + arc * 25;
      p.elbowL = -8;
      p.elbowR = -8;
      p.expression = 'smile';
      p.mouthOpen = 0.35 + arc * 0.4;
      p.eyeState = 'wide';
      p.browState = 'raised';
      break;
    }
    case 'nod': {
      p.headNod = Math.sin(t * 6.5) * 15;
      p.yOff = Math.sin(t * 2) * 1.5;
      p.shoulderL = 5;
      p.shoulderR = 5;
      p.mouthOpen = speaking ? 0.15 + 0.6 * Math.abs(Math.sin(t * 11)) : 0.1;
      p.expression = 'smile';
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'cry': {
      p.yOff = Math.abs(Math.sin(t * 3.2)) * 5;
      p.headTilt = Math.sin(t * 3.2) * 6;
      p.shoulderL = 70 + Math.sin(t * 3.2) * 6;
      p.elbowL = -95;
      p.shoulderR = 70 + Math.sin(t * 3.2 + 0.4) * 6;
      p.elbowR = -95;
      p.browState = 'sad';
      p.expression = 'cry';
      p.eyeState = 'closed';
      p.tears = true;
      p.mouthOpen = 0.3 + 0.25 * Math.abs(Math.sin(t * 7));
      break;
    }
    case 'run': {
      const ph = t * TAU * 3.1;
      p.hipL = Math.sin(ph) * 42;
      p.hipR = Math.sin(ph + Math.PI) * 42;
      p.kneeL = Math.max(0, Math.sin(ph + 1.1)) * 55;
      p.kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.1)) * 55;
      p.shoulderL = 8 + Math.sin(ph + Math.PI) * 42;
      p.shoulderR = 8 + Math.sin(ph) * 42;
      p.elbowL = -68;
      p.elbowR = -68;
      p.yOff = Math.abs(Math.sin(ph)) * 6;
      p.xOff = Math.sin(ph) * 2;
      p.bodyLean = 10;
      p.headNod = Math.sin(ph * 2) * 2.4;
      p.expression = 'neutral';
      p.mouthOpen = speaking ? 0.2 + 0.7 * Math.abs(Math.sin(t * 12)) : 0.18;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'slap': {
      // 1.1s cycle: windup → whoosh → hold
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
        // hold + recover
        const k = (cyc - 0.62) / 0.38;
        swing = 144 * (1 - k * 0.25);
        elbow = -8;
        p.bodyLean = 9 * (1 - k * 0.4);
      }
      p.shoulderR = 62 + swing;
      p.elbowR = elbow;
      p.shoulderL = -14;
      p.elbowL = -34;
      p.headNod = cyc < 0.62 ? Math.sin(cyc * 18) * 3 : 0;
      p.browState = 'angry';
      p.expression = 'angry';
      p.eyeState = 'wide';
      p.mouthOpen = speaking ? 0.25 + 0.6 * Math.abs(Math.sin(t * 13)) : 0.2;
      break;
    }
    case 'bow': {
      const cyc = (t % 2.4) / 2.4;
      // lean down, hold, rise
      const lean = Math.sin(Math.min(1, cyc * 1.6) * Math.PI) * 34;
      p.bodyLean = lean;
      p.headNod = lean * 0.55;
      p.shoulderL = 18 + lean * 1.1;
      p.shoulderR = 18 + lean * 1.1;
      p.elbowL = -58 - lean * 0.5;
      p.elbowR = -58 - lean * 0.5;
      p.yOff = -lean * 0.35;
      p.expression = 'smile';
      p.mouthOpen = speaking ? 0.15 + 0.6 * Math.abs(Math.sin(t * 12)) : 0.08;
      if (blinking(t)) p.eyeState = 'blink';
      break;
    }
    case 'think': {
      p.headTilt = 9 + Math.sin(t * 1.6) * 2.5;
      p.shoulderR = 34 + Math.sin(t * 1.6) * 3;
      p.elbowR = -122;
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
      p.yOff = Math.max(0, jolt) * 26;
      p.squash = -Math.max(0, jolt) * 0.35;
      p.shoulderL = 148 + jolt * 18;
      p.shoulderR = 148 + jolt * 18;
      p.elbowL = -12;
      p.elbowR = -12;
      p.headTilt = jolt * 6;
      p.eyeState = 'wide';
      p.browState = 'raised';
      p.expression = 'surprised';
      p.mouthOpen = 0.55 + Math.abs(jolt) * 0.3;
      break;
    }
    case 'dance': {
      const ph = t * TAU * 1.35;
      p.xOff = Math.sin(ph) * 6;
      p.yOff = Math.abs(Math.sin(ph * 2)) * 4.5;
      p.bodyLean = Math.sin(ph) * 7;
      p.headTilt = Math.sin(ph + 0.5) * 9;
      p.shoulderL = 60 + Math.sin(ph) * 95;
      p.shoulderR = 60 - Math.sin(ph) * 95;
      p.elbowL = -34 + Math.cos(ph) * 22;
      p.elbowR = -34 - Math.cos(ph) * 22;
      p.hipL = Math.sin(ph) * 8;
      p.hipR = Math.sin(ph) * 8;
      p.expression = 'laugh';
      p.eyeState = 'happy';
      p.mouthOpen = 0.45 + Math.abs(Math.sin(ph * 2)) * 0.3;
      break;
    }
    case 'fall': {
      // comedic stumble-back cycle: wobble → tip → sit → recover
      const cyc = (t % 2.2) / 2.2;
      if (cyc < 0.3) {
        const k = cyc / 0.3;
        p.bodyLean = -k * 16;
        p.shoulderL = 40 + k * 50;
        p.shoulderR = 40 + k * 50;
        p.elbowL = -100;
        p.elbowR = -100;
        p.eyeState = 'wide';
      } else if (cyc < 0.55) {
        const k = (cyc - 0.3) / 0.25;
        p.bodyLean = -16 - k * 58;
        p.yOff = -k * 34;
        p.shoulderL = 90 + k * 80;
        p.shoulderR = 90 + k * 80;
        p.elbowL = -60;
        p.elbowR = -60;
        p.hipL = -30 * k;
        p.hipR = -26 * k;
        p.kneeL = 40 * k;
        p.kneeR = 34 * k;
        p.expression = 'surprised';
        p.mouthOpen = 0.7;
        p.eyeState = 'wide';
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
        p.mouthOpen = 0.5;
        p.tears = false;
      } else {
        const k = (cyc - 0.85) / 0.15;
        p.bodyLean = -74 * (1 - k);
        p.yOff = -34 * (1 - k);
        p.shoulderL = 150 - k * 120;
        p.shoulderR = 150 - k * 120;
        p.elbowL = -40 + k * 20;
        p.elbowR = -40 + k * 20;
        p.hipL = -58 * (1 - k);
        p.hipR = -52 * (1 - k);
        p.kneeL = 58 * (1 - k);
        p.kneeR = 50 * (1 - k);
        p.expression = 'frown';
      }
      break;
    }
    case 'push': {
      const ph = Math.sin(t * 5.2);
      p.bodyLean = 12 + ph * 3;
      p.shoulderL = 84 + ph * 8;
      p.shoulderR = 84 + ph * 8;
      p.elbowL = -16 - ph * 10;
      p.elbowR = -16 - ph * 10;
      p.hipL = -12;
      p.hipR = 8;
      p.kneeL = 14;
      p.kneeR = 6;
      p.yOff = Math.abs(ph) * 1.6;
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
