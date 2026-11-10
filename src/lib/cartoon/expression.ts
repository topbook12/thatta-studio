// ============================================================
// ঠাট্টা স্টুডিও — Expression engine v2
// Coherent face: eyes + brows + mouth + FX move as ONE emotion,
// so the face reads as a feeling, not as loose parts.
// Pure data transform — no clocks, no randomness.
// ============================================================

import type { Expression, FaceFx, Pose } from './types';

/** Append one FX overlay to the pose, without duplicates (in-place). */
export function addFx(p: Pose, fx: FaceFx): void {
  if (!p.fx) p.fx = [];
  if (!p.fx.includes(fx)) p.fx.push(fx);
}

/**
 * Apply a named emotion to the pose coherently: eyeState, browState,
 * expression, tears, FX overlays and a mouthOpen floor move together.
 * Mutates `p` and returns it. `intensity` (default 1) scales the garnish
 * (happy eyes, blush, steam...). Floors only ever RAISE mouthOpen.
 */
export function applyExpression(p: Pose, name: Expression, intensity = 1): Pose {
  // every emotion speaks through its matching expression tag
  p.expression = name;
  // tears belong to crying alone
  p.tears = name === 'cry';

  switch (name) {
    case 'neutral':
      p.eyeState = 'open';
      p.browState = 'normal';
      p.fx = [];
      break;
    case 'smile':
      p.eyeState = intensity > 0.7 ? 'happy' : 'open';
      p.browState = intensity > 0.9 ? 'raised' : 'normal';
      if (intensity > 0.8) addFx(p, 'blush');
      break;
    case 'frown':
      p.eyeState = 'open';
      p.browState = 'sad';
      p.mouthOpen = 0; // mouth closed
      break;
    case 'laugh':
      p.eyeState = 'happy';
      p.browState = 'raised';
      p.fx = [];
      p.mouthOpen = Math.max(p.mouthOpen, 0.75);
      break;
    case 'cry':
      p.eyeState = 'closed';
      p.browState = 'sad';
      p.mouthOpen = Math.max(p.mouthOpen, 0.35);
      break;
    case 'angry':
      p.eyeState = 'wide';
      p.browState = 'angry';
      p.fx = ['angerVein'];
      if (intensity >= 1) addFx(p, 'steam');
      break;
    case 'surprised':
      p.eyeState = 'wide';
      p.browState = 'raised';
      p.fx = ['shockLines'];
      p.mouthOpen = Math.max(p.mouthOpen, 0.55);
      break;
  }
  return p;
}
