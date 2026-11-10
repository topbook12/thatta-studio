# Task 2-b — Backend API + Database + PWA Infrastructure (Work Record)

**Agent:** 2-b (backend/PWA developer)
**Scope:** Prisma Project model, TTS API, Projects CRUD API, PWA assets (manifest, service worker, icons, register component)

## Files Created / Modified

| File | Action |
|---|---|
| `prisma/schema.prisma` | MODIFIED — added `Project` model (existing `User`/`Post`, generator & sqlite datasource untouched) |
| `src/app/api/tts/route.ts` | NEW — POST TTS endpoint |
| `src/app/api/projects/route.ts` | NEW — GET list / POST create |
| `src/app/api/projects/[id]/route.ts` | NEW — GET single / PUT update / DELETE |
| `public/manifest.webmanifest` | NEW — Bangla PWA manifest |
| `public/sw.js` | NEW — service worker `thatta-v1` |
| `public/icons/icon-1024.png` | NEW — AI generated, true PNG 1024×1024 (539 KB) |
| `public/icons/icon-512.png` | NEW — sharp resize (182 KB) |
| `public/icons/icon-192.png` | NEW — sharp resize (41 KB) |
| `src/components/pwa-register.tsx` | NEW — `'use client'` SW registration, production-only, renders null |

NOT touched (per boundary rules): `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/db.ts`, `src/lib/cartoon/*`, `src/components/tabs/*`.

## Database

- Schema addition:
  ```prisma
  model Project {
    id        String   @id @default(cuid())
    name      String
    data      String   // JSON string: { scene, designs }
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
- `bun run db:push` → ✅ success, Prisma Client v6.19.2 regenerated. DB: `db/custom.db` (sqlite, `DATABASE_URL` from `.env`).

## API Contracts (for the UI developer)

### POST /api/tts
- Body: `{ text: string (1..1000), voice?: 'tongtong'|'chuichui'|'xiaochen'|'jam'|'kazi'|'douji'|'luodo' (default 'tongtong'), speed?: 0.5–2.0 (default 1.0) }`
- Success → `audio/wav` binary (`Content-Type: audio/wav`, `Cache-Control: no-store`).
- Validation error → 400 `{ error, details[] }`. Server error → 500 `{ error, message }`.
- Runtime: nodejs, maxDuration 120.

### GET /api/projects
- → 200 `{ projects: [{ id, name, createdAt, updatedAt }] }` (no `data` field), ordered `updatedAt desc`.

### POST /api/projects
- Body `{ name (1..80), data (JSON string ≤ 2MB) }` → 201 `{ project }`. Bad JSON → 400.

### GET /api/projects/[id]
- → 200 `{ project: { id, name, data, createdAt, updatedAt } }`; 404 if missing.

### PUT /api/projects/[id]
- Body: `name` and/or `data` (at least one required) → 200 `{ project }`; 404 if missing.

### DELETE /api/projects/[id]
- → 200 `{ ok: true }`; 404 if missing.

## Test Results (all via curl against dev server :3000)

- **TTS Bangla test:** `POST /api/tts {"text":"কি রে গোপাল, কেমন আছিস?"}` → HTTP 200, **191,376 bytes WAV** (RIFF PCM 16-bit mono 24 kHz, ~2.7s). Signal analysis: peak amplitude 23,197, RMS 0.0762 → **real audible audio, NOT silent**. ✅
- **Projects CRUD:** GET list `{"projects":[]}` 200 → POST create 201 (id `cmwaaitmq0000q3xg27rurzuj`) → GET single 200 (includes `data`) → PUT update 200 (`updatedAt` bumped) → GET 404 on unknown id → DELETE `{ok:true}` 200 → GET after delete 404 → TTS empty-text 400 with zod details. ✅
- **Static PWA assets:** `/manifest.webmanifest` 200 `application/manifest+json`; `/icons/icon-192.png` & `/icons/icon-512.png` 200 `image/png`; `/sw.js` 200 `application/javascript`. ✅
- **Lint:** `bun run lint` → zero errors. ✅
- **dev.log tail:** all route logs 200/201/404/400 as expected, no runtime errors/exceptions. ✅

## Notes / Caveats for the Next Agent

1. **TTS is non-streaming** (`stream: false`, `response_format: 'wav'`). Response is raw `audio/wav` — frontend should use `fetch` + `URL.createObjectURL(blob)` (or `<audio src>` to `/api/tts` via POST blob). Don't parse it as JSON.
2. **Voices**: the 7 allowed values are enforced by zod. Default is `tongtong`. If the UI passes an unknown voice it gets a 400 — surface that error.
3. **`data` field is an opaque JSON string** (max 2MB) — the canvas team serializes `{ scene, designs }` themselves; the API doesn't validate its inner shape on purpose.
4. **Service worker** never caches `/api/*` (checked via pathname substring), skip non-GET, navigation → network-first w/ cached `/` fallback, same-origin assets → cache-first. Cache name `thatta-v1`; bump this string to invalidate.
5. **pwa-register.tsx** exports both named (`PwaRegister`) and default. It renders null and registers `/sw.js` only when `NODE_ENV === 'production'` — the layout owner can mount it anywhere (e.g. inside `<body>`).
6. **Icons**: the z-ai CLI emitted JPEG bytes despite the `.png` extension; I re-encoded icon-1024.png to true PNG with sharp, then produced 512/192 from it. All three verified as real PNGs.
7. `manifest.webmanifest` is served with the correct MIME type by Next 16 out of the box — no config needed. Layout owner still needs `<link rel="manifest" href="/manifest.webmanifest" />` + theme-color meta if they want full PWA polish (that's in their boundary).
