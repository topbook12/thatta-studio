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
- [ ] Scene list panel — add / duplicate / reorder / delete scenes
- [ ] Transitions per scene boundary: cut / fade / cartoon wipe
- [ ] Episode preview play-through (scenes chained, transitions applied)
- [ ] Script importer: paste Bangla dialogue → auto-draft beats (speaker → actor mapping UI)
- [ ] Export whole episode as one MP4
- **Files:** `store.ts` (scene[] migration with old-data upgrade), `engine.ts`, `exporter.ts`, new `scenes-tab.tsx`

**Accept:** 3-scene episode builds, plays, and exports; v0 projects auto-upgrade without data loss.

### Phase 3 (Day 21–30) — Advanced animation control
**Goal:** "যেকোনো অবজেক্টের মুভমেন্ট নিখুঁতভাবে কন্ট্রোল" — the core mantra.
- [ ] Two-action blending (walk + talk simultaneously; secondary-action slider)
- [ ] Custom pose editor — drag joints on a rig to create a reusable pose action
- [ ] Motion paths: curved walk targets (bezier), jump arcs with gravity preview
- [ ] Per-beat easing curve editor (visual graph, 6 presets + custom cubic-bezier)
- [ ] 2-character interaction presets (slap+reaction sync, handshake, বহিষ্কার chase)
- **Files:** `pose.ts`, `skeleton.ts`, `engine.ts`, new `pose-editor.tsx`

**Accept:** every beat's position/speed/easing is editable from UI; blended actions stay 60 fps on mid-range Android.

### Phase 4 (Day 31–40) — Sound studio
**Goal:** cartoon sounds as rich as the visuals.
- [ ] Background music library (procedurally synthesized দেশি loops, no licensing risk)
- [ ] SFX library auto-synced to impact actions (slap/ fall/ laugh) with volume control
- [ ] Visible audio track on timeline (music/SFX/voice lanes with waveforms)
- [ ] Record own voice (mic) with basic noise gate; use in any beat
- [ ] Per-character voice pitch/style fine-tuning persisting with the design
- **Files:** new `audio-engine.ts`, `timeline-editor.tsx`, `/api/tts` unchanged

**Accept:** scene with music + 2 SFX + 4 voice lines exports with correctly mixed audio.

### Phase 5 (Day 41–50) — World building: backgrounds & props
**Goal:** more realistic, customizable environments (continues the realism push).
- [ ] Background customizer: time-of-day slider (ভোর/দুপুর/সন্ধ্যা/রাত), weather (clear/বৃষ্টি/কুয়াশা), color mood
- [ ] 3 new backgrounds: রেলস্টেশন, সিনেমা হল, মেলা
- [ ] 4 new props: চায়ের কাপ, মোবাইল, ব্যাগ, চেয়ার
- [ ] Decor layer: place trees/rickshaw/stalls anywhere (draggable, depth-aware)
- [ ] Weather particles integrated with ambience system
- **Files:** `backgrounds.ts` (keep 2× supersample + cache), `props.ts`, `depth.ts`

**Accept:** same background renders 4 time variants + rain at stable fps; decor items sort correctly with characters by z.

### Phase 6 (Day 51–60) — Export & share
**Goal:** one click from studio to audience.
- [ ] 1080p60 export option (WebCodecs config matrix)
- [ ] GIF export (first 6 s loop, for social)
- [ ] Thumbnail designer: pick frame + title text style → PNG
- [ ] Bangla subtitle burn-in toggle (renders dialogue text)
- [ ] Share link: cloud project public read-only view
- **Files:** `exporter.ts`, new `thumbnail.ts`, new public share route

**Accept:** 1080p60 export of a 30 s scene completes on mid-range laptop without OOM; share link opens on a phone.

### Phase 7 (Day 61–70) — Community gallery (free)
**Goal:** creators inspire creators.
- [ ] Public gallery grid (curated, no moderation overhead: report button first)
- [ ] Character/template file export-import (JSON, works offline, shareable via WhatsApp)
- [ ] Like counts; "সপ্তাহের সেরা" list
- [ ] Creator profile page (name, avatar from character, public cartoons)
- **Files:** Prisma schema additions (GalleryItem, Like, Profile), API routes, new gallery tab

**Accept:** publish → appears in gallery → like → unlink/remove works; offline never blocks editing (gallery is online-only, clearly marked).

### Phase 8 (Day 71–80) — Performance & mobile
**Goal:** smooth on a $120 Android phone.
- [ ] Quality mode selector: Auto/High/Battery (reduced supersampling, effects scale)
- [ ] Memory audit: background cache LRU, frame object pooling
- [ ] Touch gestures: pinch-zoom stage, two-finger pan
- [ ] Offline storage manager UI: usage meter, per-project size, one-tap cleanup
- **Accept:** 60 fps playback of 5-character scene on Android Go profile; storage manager clears ≥1 project without app restart.

### Phase 9 (Day 81–90) — AI copilots (server-side SDK only)
**Goal:** AI removes the blank-page problem.
- [ ] Bangla comedy story idea generator (3 premises per click)
- [ ] Dialogue punch-up suggestions (safe, family-friendly filter)
- [ ] Idea → auto-storyboard draft (premises → beats skeleton the user edits)
- [ ] Thumbnail text suggestions
- **Files:** new `/api/ai/*` routes using z-ai-web-dev-sdk; graceful offline degradation (AI features simply hidden offline)

**Accept:** one-tap flow idea → draft beats → user edits → playable scene in <2 min.

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
