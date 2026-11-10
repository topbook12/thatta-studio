// ============================================================
// ঠাট্টা স্টুডিও — Pose computation (procedural actions)
// ============================================================

import type { ActionName, Pose } from './types';

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
      p.bodyLean = 3;
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
      const arc = Math.sin(cyc * Math.PI);
      p.yOff = arc * 58;
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
