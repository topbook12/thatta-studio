# Sprint 2 — Animation Principles Pass (Work Record)

**Scope:** 12 classic animation principles on all 18 actions, Expression engine v2 (+ Face FX), Prop system, fist rendering.

## Files Created

| File | Purpose |
|---|---|
| `src/lib/cartoon/skeleton.ts` | Shared skeleton constants + `handXform(pose, side)` forward kinematics (hand position/angle) — used by props & draw |
| `src/lib/cartoon/props.ts` | Prop renderer: `drawProp(ctx, prop, pose, t)` — stick/umbrella/pot/basket/fan attached to near hand; swing/lag secondary motion per prop |
| `src/lib/cartoon/expression.ts` | Expression engine v2: `applyExpression(pose, name, intensity)` (coherent eyes/brows/mouth/tears/fx floors), `addFx(pose, fx)` |

## Files Modified

| File | Change |
|---|---|
| `src/lib/cartoon/types.ts` | `FaceFx` type (`angerVein/steam/sweat/shockLines/music/blush/zzz`), `Pose.fx?: FaceFx[]`, `Pose.fist?: boolean`, `PropName` (`none/stick/umbrella/pot/basket/fan`), `PlacedCharacter.prop?` (optional → old saves valid) |
| `src/lib/cartoon/pose.ts` | **v2** — principle helpers (`settle`, `lagSin`, `reach`); every action upgraded: walk elbow-lag 0.55 + delayed counter-bob + footstrike squash, run bigger + fist, wave forearm whip, slap damped follow-through, jump landing follow-through, dance 3 phase-shifted rhythms + music fx, push sweat fx, angry tremble + angerVein/steam, surprise settle wobble + shockLines, bow anticipation + eyes closed at depth, fall windmill flail, cry heave, think scratch circles, nod body lag, point overshoot-settle, idle breathing squash + weight shift |
| `src/lib/cartoon/draw.ts` | Imports from skeleton.ts (local constants removed); `drawArm` fist param + grip lines; `drawFaceFx` (all 7 fx, flip-safe drawn shapes, no text glyphs); `drawCharacter(ctx, design, pose, t, prop = 'none')` draws prop after near arm |
| `src/lib/cartoon/engine.ts` | Render call passes `placed.prop ?? 'none'` |
| `src/lib/cartoon/presets.ts` | `PROP_OPTIONS` (Bengali labels + emoji) |
| `src/components/tabs/studio-tab.tsx` | "হাতের জিনিস" prop Select per character card (`updatePlaced(uid, {prop})`) |
| `docs/plan-100-din.md` | Sprint 1 & 2 marked ✅, Sprint 3 marked current |

## API contract preserved
`basePose()`, `computePose(action, t, speaking)`, `easeInOut`, `easingByName` unchanged & deterministic (scrub/export-safe). `drawCharacter` 5th param optional → creator-tab call sites untouched.

## Verified (Agent Browser + lint)
- Lint 0 errors. Dev server 200, no console/page errors.
- Prop selector renders for each character; লাঠি + ছাতা attach to hands and follow poses (verified live: wave w/ stick, angry-arm w/ umbrella).
- Playback runs all beats; angry beat shows angerVein fx; finish/reset behavior unchanged.
- Creator tab renders all thumbnails + live preview with new pose engine.
- Mobile 390px layout OK.

## Notes for next sprint (Sprint 3 — content library)
- New actions must fill `fx`/`fist` coherently (use `applyExpression`).
- More props: add case in `props.ts` `drawProp` + entry in `presets.ts` `PROP_OPTIONS` — that's all.
- Female rig v2 should keep `handXform` in sync if arm geometry changes (props depend on it).
