// ============================================================
// ঠাট্টা স্টুডিও — Skeleton geometry (shared by renderer & props)
//
// Local character space: ground at y=0, character faces +x,
// height ≈ 200 units. All rotations are in degrees in the Pose,
// converted with D here.
// ============================================================

import type { Pose } from './types';

export const D = Math.PI / 180;

// ---------------- skeleton constants ----------------
export const HIP_Y = -88;
export const HIP_LX = -9;
export const HIP_RX = 9;
export const THIGH = 44;
export const SHIN = 44;
export const SHOULDER_Y = -142;
export const SHOULDER_LX = -22;
export const SHOULDER_RX = 22;
export const UPPER_ARM = 32;
export const FOREARM = 30;
export const HEAD_CX = 0;
export const HEAD_CY = -182;
export const HEAD_R = 30;
export const EYE_LX = -11;
export const EYE_RX = 11;
export const EYE_Y = HEAD_CY - 8;
export const BROW_Y = HEAD_CY - 17;
export const MOUTH_X = 2;
export const MOUTH_Y = HEAD_CY + 15;

export type Side = 'L' | 'R';

export interface HandXform {
  /** hand center x (character-local) */
  x: number;
  /** hand center y (character-local) */
  y: number;
  /** hand/forearm direction in radians (0 = pointing +x when unwrapped) */
  angle: number;
}

/**
 * Forward-kinematics position of a hand, mirroring exactly how drawArm
 * nests its translations/rotations. Used by the prop system so that
 * held items stick to the hand whatever the action is doing.
 */
export function handXform(pose: Pose, side: Side): HandXform {
  const jx = side === 'L' ? SHOULDER_LX : SHOULDER_RX;
  const jy = SHOULDER_Y;
  const shoulder = side === 'L' ? pose.shoulderL : pose.shoulderR;
  const elbow = side === 'L' ? pose.elbowL : pose.elbowR;

  const a1 = -shoulder * D; // upper-arm rotation (matches drawArm)
  const cos1 = Math.cos(a1);
  const sin1 = Math.sin(a1);
  // elbow = shoulder + R(a1)·(0, UPPER_ARM)
  const ex = jx + -sin1 * UPPER_ARM;
  const ey = jy + cos1 * UPPER_ARM;

  const a2 = a1 + elbow * D; // forearm rotation
  const cos2 = Math.cos(a2);
  const sin2 = Math.sin(a2);
  // wrist = elbow + R(a2)·(0, FOREARM + 2)
  const wx = ex + -sin2 * (FOREARM + 2);
  const wy = ey + cos2 * (FOREARM + 2);

  return { x: wx, y: wy, angle: a2 };
}
