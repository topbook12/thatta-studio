// ============================================================
// ঠাট্টা স্টুডিও — Sprint 6: pseudo-3D depth projection
//
// A pinhole camera model gives every character real depth:
//   • z = 0        → the flat stage plane (exactly like before)
//   • z > 0 (আঁধার) → farther away: smaller, higher ground line,
//                     drifting towards the vanishing point, hazy
//   • z < 0        → closer to the viewer: bigger, lower ground line
// All helpers are pure functions — deterministic for scrubbing/export.
// ============================================================

import { GROUND_Y, STAGE_H, STAGE_W } from './types';

/** focal length in px — bigger = gentler perspective */
export const FOCAL = 900;
/** horizon line (y px): where characters would stand at infinite depth */
export const HORIZON_Y = 430;
/** vanishing point (x px): horizontal convergence target */
export const VP_X = STAGE_W / 2;

/** safe depth range in px */
export const Z_MIN = -120;
export const Z_MAX = 480;

export function clampZ(z: number): number {
  if (!Number.isFinite(z)) return 0;
  return Math.max(Z_MIN, Math.min(Z_MAX, Math.round(z)));
}

/** perspective scale factor at depth z (1 at z=0) */
export function depthScale(z: number): number {
  return FOCAL / (FOCAL + z);
}

/** ground line (y px) at depth z — where the character's feet stand */
export function groundYAt(z: number): number {
  return HORIZON_Y + (GROUND_Y - HORIZON_Y) * depthScale(z);
}

/**
 * World x (px) at depth z: converges towards the vanishing point as the
 * character walks deeper — the classic 3D perspective path.
 */
export function worldXAt(baseXpx: number, z: number): number {
  return VP_X + (baseXpx - VP_X) * depthScale(z);
}

/** subtle atmospheric haze — far objects fade slightly into the scene */
export function depthAlpha(z: number): number {
  if (z <= 0) return 1;
  return 1 - Math.min(0.3, (z / FOCAL) * 0.42);
}

/** one-line human summary for UI hints */
export function depthLabel(z: number): string {
  if (z > 40) return `দূরে (${bnZ(z)})`;
  if (z < -40) return `কাছে (${bnZ(z)})`;
  return `স্টেজে (${bnZ(z)})`;
}

function bnZ(z: number): string {
  return String(Math.round(z)).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
}

export { STAGE_W, STAGE_H };
