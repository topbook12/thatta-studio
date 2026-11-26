# Thatta Studio (ঠাট্টা স্টুডিও) — 100-Day Full Platform Development Plan

> **Mission:** turn the working cartoon studio into a polished, user-friendly, advanced
> creation platform for Bengali comedy cartoons — in 100 days, 10 phases × 10 days.
> **Non-goals:** no monetization, no business model work until Day 100. Product first.
> **Source of truth for in-app display:** `src/lib/roadmap.ts` (kept in sync with this file).

---

## 0. Where we start (Day 0 baseline — all verified working)

| Area | Shipped |
|---|---|
| Studio | Beat-based timeline (multi-track, drag/resize/reassign), 27 actions, 11 Bengali props, 6 easings, cinematic camera (pan/zoom/shots/shake), drag-on-stage, global + per-beat speed |
| World | 13 hand-painted procedural backgrounds with living ambience, pseudo-3D depth (z −120..480), contact shadows, HiDPI rendering |
| Characters | Part-based creator (skin/hair/eyes/brows/mouth/top/bottom/headwear/beard/glasses), 5-preset cast, 7 TTS voices, real lip-sync (FFT viseme envelopes) |
| Export | WebCodecs MP4 (H.264 + AAC/Opus, exact-timestep frames) + MediaRecorder fallback, 720/1080p, title card, fades, cancel + progress |
| Platform | Installable PWA, **fully offline** (SW precache + self-hosted Hind Siliguri fonts), device projects (localStorage, quota-evicting), cloud projects (Prisma/SQLite), IndexedDB voice cache |
| Learning | 6-lesson Bengali course with saved progress |
| Quality | `tsc --noEmit` clean, `eslint` clean, browser golden-path verified |

### Day-0 hardening already landed (this plan's kickoff commit)

- **Fixed all TypeScript errors** in `src/lib/cartoon/exporter.ts` (WebCodecs chunk/metadata casts), excluded non-app folders from `tsc`, zero lint warnings.
- **Fixed lint warning** on Google Fonts by **self-hosting Hind Siliguri** (12 woff2 files, `@font-face`, SW precache `thatta-v9`) — Bangla text now renders offline on first cold load.
- **Advanced tooling:** global **Undo/Redo** (`src/lib/history.ts`, 60-step stack, 450 ms gesture coalescing so one Ctrl+Z undoes a whole drag), **keyboard shortcuts** (Space, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) with an in-app cheat-sheet dialog, and a **Roadmap dialog** in the header showing live plan progress.
- **Repo hygiene:** `.gitignore` root-anchored `/local-*`, tsconfig excludes `examples/`, `skills/`, `mini-services/`.

---

## 1. Ground rules for all 100 days

1. **Quality bar (checked every phase):**
   - `bun run lint` → 0 errors, 0 warnings; `bunx tsc --noEmit` → 0 errors.
   - Browser golden path verified (play scene, edit beat, generate voice, export, offline reload).
   - All UI text stays in **Bangla**; mobile one-hand usable; footer sticky on every viewport.
2. **Weekly rituals:**
   - *Friday:* bug bash — click through every tab, watch `dev.log` for runtime errors, fix same day.
   - *Sunday:* performance profile on a mid-range Android profile + storage audit.
   - *Phase end:* `git tag phase-N`, update `roadmap.ts` + this doc, write release notes.
3. **"Find and fix all errors" protocol** (continuous, not one-time):
   - Static: `tsc --noEmit`, `eslint`, Next.js build warnings treated as errors.
   - Runtime: `dev.log` scan after every feature; console-error-free golden path before any commit.
   - Data: round-trip every persistence path (save → reload → offline reload → old-version upgrade).
   - UX: every new screen tested at 390×844 and 1280×800.
4. **Every phase ships user-visible value** — no refactor-only phases.

---

## 2. The 100-day plan (10 phases × 10 days)

### Phase 1 (Day 1–10) — User-friendly core: "ভুল করলেও ভয় নেই"
**Goal:** a beginner can never lose work or feel lost.
- [x] Undo/Redo with drag-gesture coalescing (`src/lib/history.ts`)
- [x] Keyboard shortcuts + cheat-sheet dialog
- [x] **Autosave + crash recovery** — debounced (3 s) save to rotating backup slots (`thatta.autosave.a/b`, previous good snapshot always survives a mid-write crash); clean-exit flag detects killed sessions and offers the backup; per-tab error boundary with "ব্যাকআপ রিস্টোর করুন" exit
- [x] **Scene templates** — 5 ready-made one-click scenes (বাজার কাণ্ড, স্কুল মজা, নদীর ধারে, রাজসভার হাসি, রাতের ভয়) from a "টেমপ্লেট" picker; designs merge by name so user tweaks survive
- [x] **Guided first-run tour** — 4-step coach marks (stage → timeline → voice → export), auto-opens once, replayable from the toolbar (compass button)
- [x] Empty-state tips in timeline, character panel & beat form (what to do next) + live "স্বয়ংক্রিয় সেভ" pill

**Accept (verified):** kill the tab mid-edit → reopen → recovery dialog offers the backup → restore returns the exact state; undo reverts a whole template load in one Ctrl+Z; a new user gets a 4-step tour and template one-click start without reading the course.

**Bonus hardening found & fixed during Phase 1 browser verification:**
- `onRehydrateStorage` referenced the store inside its own `create()` initializer — a swallowed TDZ error silently killed persist hydration (`hasHydrated()` stayed false forever). Replaced with a sanitized `merge()` (also guards corrupted `designs`/`scene` shapes).
- Crash-recovery check is now race-proof (listener registered before `hasHydrated()` probe + 1.5 s fallback).

### Phase 2 (Day 11–20) — Story system: multi-scene episodes
**Goal:** full sketch episodes, not single scenes.
- [x] Scene list panel — add / duplicate / rename / reorder / delete scenes (strip above the stage, `[` `]` keyboard nav, AlertDialog delete-confirm, 12-scene cap)
- [x] Transitions per scene boundary: cut / fade (through black) / cartoon circle-wipe — per-scene outgoing transition, rendered in the MP4 export (fade verified by frame-brightness probe at the boundary)
- [x] Episode preview play-through (scenes chained with auto-advance; toggle "সম্পূর্ণ এপিসোড" near Play; playback shows "এপিসোড: দৃশ্য ২/২"; transitions preview as cut)
- [x] Script importer: paste Bangla dialogue → auto-draft beats (speaker → actor mapping UI) — *verified:* 7-line script with `(রেগে)/(হাসতে হাসতে)` hints + `--- বাজারে গন্ডগোল ---` marker → 6 beats / 2 scenes in one click; hint→action mapping (😠 😂), fuzzy speaker match + hand-assign in preview
- [x] **Voice mapping** (roadmap item): "ভয়েস ম্যাপিং" card — every character × voice (7 voices), audition sample (TTS 200), per-character **rebuild** re-records all spoken beats of that character across the episode
- [x] Export whole episode as one MP4 (WebCodecs walks scene-by-scene via `prepareExportScene`; realtime MediaRecorder fallback records the chained play-through; scope radio in export dialog)
- **Files:** `store.ts` (scenes[] migration with old-data upgrade), `engine.ts` (pure `computeBeatWindows`, `prepareExportScene`), new `episode.ts` (timing/windows/buses math), `exporter.ts` untouched, new `studio/scene-strip.tsx`, `studio-tab.tsx` wiring, `history.ts` + `autosave.ts` episode-aware snapshots

**Accept (verified in browser):** 2-scene episode builds, plays through (auto scene-advance confirmed live), and exports as one 25.0 s H.264 MP4; single-scene v0 project auto-upgraded to a 1-scene episode without data loss; undo restores a deleted scene.

### Phase 3 (Day 21–30) — Advanced animation control
**Goal:** "যেকোনো অবজেক্টের মুভমেন্ট নিখুঁতভাবে কন্ট্রোল" — the core mantra.
- [x] Two-action blending — `action2` on a beat; `blendPoses()` mixes a secondary gesture (wave/point/clap/nod/think/salute/eat/carry) over the primary action at 55% (face stays primary; lip-sync still rules the mouth) — verified: slap beat + wave blend plays live, violet badge in beat list
- [x] Custom pose editor — per-beat `poseOffset` (bodyLean / headTilt / both shoulders & elbows / yOff) tuned with 7 sliders + a LIVE mini-canvas preview running the real pipeline (computePose → blend → offsets); "🦴 পোজ টিউন" badge; all offsets clamped in `sanitizePoseOffset`
- [x] Motion paths — walk/run route shapes: straight / **arc** (swings deeper mid-way, sin(π)) / **sCurve** (near-far-near weave, sin(2π)); destination stays exact so walk chains still align; "🛤 বাঁকা পথ" badge
- [x] Per-beat easing curve editor — SVG speed graph: 6 preset mini-curves + **custom cubic-bezier with two draggable handles** (`cubicBezierEase` solver, deterministic for scrub/export); "📈 কাস্টম কার্ভ" badge
- [x] 2-character interaction presets — 6 one-click choreographies (কথোপকথন, থাপ্পড় কাণ্ড, ধাওয়া, সালাম-সম্মান, একসাথে উদযাপন, খোঁচা ও কান্না) with comic-impact reaction timing; appended at scene end in ONE undo step
- **Files:** `pose.ts` (`blendPoses`, `applyPoseOffsets`, `cubicBezierEase`, `easingByName(custom)`), `engine.ts` (blend/offset/path/easing in the render loop), `types.ts` (`action2`/`poseOffset`/`pathStyle`/`customEasing`), new `script-parser.ts`, `interactions.ts`, new `studio/{script-dialog,interaction-dialog,easing-curve-picker,pose-editor,voice-mapping}.tsx`, `presets.ts` (normalize + option lists), `studio-tab.tsx` wiring

**Accept (verified in browser):** script paste → 2 scenes/6 beats; slap preset → +5 beats with reaction timing; pose slider (head tilt ০.৯) shows in the live preview, "টিউনড" badge on save; custom bezier handle drag reshapes the graph; বাঁকা পথ + কাস্টম কার্ভ + mix-wave all persist through playback — zero console errors at 1280×800 and 390×844.

### Phase 4 (Day 31–40) — Sound studio
**Goal:** cartoon sounds as rich as the visuals.
- [x] Background music library (procedurally synthesized দেশি loops, no licensing risk) — 6 tracks (ধামাকা ঢোল, বাঁশির সুর, মজার সুর, দুঃখের সুর, রহস্যের আবহ, উৎসবের বাজনা) + audition play + per-scene volume slider
- [x] SFX library auto-synced to impact actions (slap/ fall/ laugh) with volume control — SFX lane on the timeline with one-tap events
- [x] Visible audio track on timeline (music/SFX/voice lanes with waveforms) — verified: ধামাকা ঢোল renders as a waveform strip at ৬০%
- [x] Record own voice (mic) with basic noise gate; use in any beat
- [x] Per-character voice pitch/style fine-tuning persisting with the design
- **Files:** `audio/{music,sfx,clips,pitch,wav,pitch}.ts`, `sound-studio.tsx`, `timeline-editor.tsx`, `/api/tts` unchanged

**Accept (verified):** সাউন্ড স্টুডিও dialog → মিউজিক tab → ধামাকা ঢোল সেট → volume ৬০% → toast "এক্সপোর্টেও আসবে" → টাইমলাইনে মিউজিক লেন waveform + SFX লেন দেখা যায়।

### Phase 5 (Day 41–50) — World building: backgrounds & props
**Goal:** more realistic, customizable environments (continues the realism push).
- [x] Background customizer: time-of-day slider (ভোর/দুপুর/সন্ধ্যা/রাত), weather (clear/বৃষ্টি/কুয়াশা), color mood
- [x] 3 new backgrounds: রেলস্টেশন, সিনেমা হল, মেলা (16 total) — verified in the bg picker chips
- [x] 4 new props: চায়ের কাপ, মোবাইল, ব্যাগ, চেয়ার
- [x] Decor layer: place trees/rickshaw/stalls anywhere (draggable, depth-aware) — verified: গাছ/রিকশা/চেয়ার/মেলার দোকান buttons + depth-sorted render
- [x] Weather particles integrated with ambience system — verified: বৃষ্টি streaks render on the live stage
- **Files:** `backgrounds.ts` (keep supersample + cache), `decor.ts`, `engine.ts` (environment pass), `store.ts` (scene.environment)

**Accept (verified):** rain + decor tree render on stage together; time-of-day + warmth grade over the graded frame.

### Phase 6 (Day 51–60) — Export & share
**Goal:** one click from studio to audience.
- [x] 1080p60 export option — verified: resolution combo "720p HD | 1080p Full HD" + fps combo "২৪ | ৩০ | ৬০fps"
- [x] GIF export (social loop) — verified: 480×270, ১২০-frame render progress (২৭/১২০ → done), downloads automatically
- [x] Thumbnail designer: pick frame + title text style → PNG — verified: live stage backdrop preview, 4 themes, title/subtitle inputs
- [x] Bangla subtitle burn-in toggle (renders dialogue text)
- [x] Share link: Web Share API + gallery publish flow
- **Files:** `exporter.ts`, `gif-exporter.ts`, `thumbnail-dialog.tsx`, `publish-dialog.tsx`

**Accept (verified):** export dialog exposes all options; GIF completes without console errors; thumbnail designer renders the live scene.

### Phase 7 (Day 61–70) — Community gallery (free)
**Goal:** creators inspire creators.
- [x] Public gallery grid (curated, no moderation overhead: report button first) — গ্যালারি tab with search + নতুন/জনপ্রিয় sort
- [x] Character/template file export-import (JSON, works offline, shareable via WhatsApp)
- [x] Like counts — verified end-to-end: publish "রেইনি দিনের মজা" → appears in gallery → like ০→১ (API 201/200 in dev.log)
- [x] Creator profile — author chip filter ("✍️ গোপাল ফ্যান")
- [x] **স্টুডিওতে খুলুন** — verified: gallery → studio loads the full episode with toast
- **Files:** Prisma schema (GalleryItem, Like), `/api/gallery/*` routes, `gallery-tab.tsx`, `publish-dialog.tsx`

**Accept (verified):** publish → gallery card → like → open-in-studio, zero console errors; offline never blocks editing (gallery clearly marked online-only).

### Phase 8 (Day 71–80) — Performance & mobile
**Goal:** smooth on a $120 Android phone.
- [x] Quality mode selector: অটো/উচ্চ মান/ব্যাটারি সেভ (`render-quality.ts`: Auto resolves from hardwareConcurrency/deviceMemory; battery → 1.25× supersampling instead of 2×, ~45% ambient particles) — toolbar segmented control with tooltips
- [x] Memory audit: background cache LRU (bg ≤10 + fg ≤8 canvases, was unbounded ≈450 MB worst case), weather/ambient particle density scales with quality
- [x] Touch gestures: two-finger pinch-zoom stage (engine pointer map, zoom 1–3× cumulative, clamped pan, floating ১:১ reset chip, `touch-action: none`)
- [x] Offline storage manager UI: quota meter (`navigator.storage.estimate`), voice-cache size + clear, per-project size/delete, one-tap "পুরনোগুলো মুছুন" (keeps newest 5)
- **Accept:** quality switch rebuilds caches at the new scale (versioned keys), stage drag + zoom coexist, storage manager clears projects without app restart.

### Phase 9 (Day 81–90) — AI copilots (server-side SDK only)
**Goal:** AI removes the blank-page problem.
- [x] Bangla comedy story idea generator (3 premises per click) — verified: "আইডিয়া আনুন" → 3 cast-aware premises (নানুর বিসরে বিশ ধান / রামায়ণ ঘোরানোর ভাগ্য / মামা মুন্নার নতুন কাজুত)
- [x] Dialogue punch-up suggestions (safe, family-friendly filter) — verified: per-line strikethrough → ✨ suggestion + note; "বসান" replaces the beat text and clears the stale TTS cache (new voice re-records automatically)
- [x] Idea → auto-storyboard draft — verified: premise → script in the exact Phase 2 parser format (`নাম (হাসতে হাসতে): সংলাপ` + `--- দৃশ্য ---`) → editable draft box → "স্ক্রিপ্ট এডিটরে পাঠান" prefills ScriptDialog → parse → **৮টি বিট • ২টি দৃশ্য** applied in one flow
- [x] Thumbnail text suggestions — verified: "AI টাইটেল" chip button in the thumbnail designer → 5 short title+subtitle pairs → tap fills both inputs
- **Files:** `src/lib/ai-server.ts` (shared ZAI client + JSON extraction + clamps), `/api/ai/{story-ideas,storyboard,punch-up,thumbnail-text}` routes (family-safe system prompts, robust JSON parse, timeouts), `src/lib/ai-client.ts` (aiPost + `useIsOnline`), new `studio/ai-copilot.tsx` (ideas + punch-up tabs), script-dialog AI-handoff (`initialText` via render-time state adjustment), thumbnail-dialog AI chips, studio-tab "AI সহকারী" button
- Graceful offline degradation: AI button + thumbnail chips **hidden** via live online/offline listeners (verified: flip offline → both vanish, studio keeps working)
- **Bonus hardening found during verification:** `sw.js` install now `skipWaiting`s only when the app shell actually precached — an offline install can no longer activate an empty cache and wipe the good old cache (offline mode can't be bricked by a version bump)

**Accept (verified):** one-tap flow idea → draft beats → user edits → playable scene works end-to-end; all 4 AI routes return proper Bangla error JSON; tsc + eslint clean.

### Phase 10 (Day 91–100) — Launch polish: v1.0
**Goal:** confidence + completeness.
- [ ] Full UX audit with 5 first-time users; fix top-10 frictions
- [ ] Accessibility pass: full keyboard navigation, ARIA labels, focus rings, contrast
- [ ] Intermediate course (7 lessons): camera craft, audio, episode building
- [ ] v1.0 release: install prompt polish, release notes, deploy hardening (Vercel + standalone), docs refresh

**Accept:** all quality-bar gates green; fresh user completes course + creates cartoon in one sitting; `git tag v1.0`.

---

## 3. KPIs at Day 100

| Metric | Target |
|---|---|
| Time from blank stage to exported 30 s cartoon (new user) | ≤ 15 min |
| Crash/lost-work reports | 0 (autosave + undo everywhere) |
| Playback fps, 5 characters, mid-range Android | 60 |
| Cold offline load (installed PWA, airplane mode) | < 3 s, zero console errors |
| Backgrounds / actions / props | 16+ / 35+ / 15+ |
| Course completion rate (baseline vs Day 100) | +30% |
| `tsc` + `eslint` | permanently clean |

## 4. Risk register

| Risk | Mitigation |
|---|---|
| Multi-scene migration breaks old saved projects | version field + `normalizeScene` upgrade path + round-trip tests each phase |
| WebCodecs gaps on some phones | MediaRecorder fallback stays; capability matrix in export dialog |
| localStorage quota (device projects) | existing eviction + Phase 8 storage manager |
| AI routes offline/unavailable | features hidden offline; never block core studio |
| Scope creep | every phase has accept criteria; anything extra goes to backlog file |

## 5. Progress convention

- Each item above flips to `[x]` **only after** browser-verified golden-path testing.
- `src/lib/roadmap.ts` mirrors this plan for the in-app Roadmap dialog.
- Phase completion = commit + `git tag phase-N` + push to `github.com/topbook12/thatta-studio`.

> 💰 **Monetization: fully off until Day 100.** Product quality first, business later.
