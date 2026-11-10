"use client";

/**
 * টাইমলাইন এডিটর v2 (Timeline Editor) — ঠাট্টা স্টুডিও
 *
 * Multi-track timeline: every beat lives at an ABSOLUTE start time on its
 * actor's row, so several characters can act at the same moment.
 *
 * Interactions:
 *  - Click / drag on the ruler or empty row space  → seek (onSeek)
 *  - Drag a beat block horizontally                → change its start time
 *  - Drag a beat block onto another actor's row    → reassign the actor
 *  - Drag the right edge of a beat block           → resize (0.5s..20s)
 *  - Click on a beat block                         → select + seek to start
 *  - While `playing`, the view auto-follows the playhead
 *
 * Overlap safety: a moved/resized beat always snaps into the nearest free
 * gap of its own actor's track (no two beats of the same actor collide).
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface TimelineBeat {
  id: string;
  actorUid: string;
  actorName: string;
  actorColor: string; // tailwind-safe inline color for the block bg
  action: string; // ActionName
  actionEmoji: string;
  actionLabel: string; // Bengali label
  text: string; // dialogue (may be empty)
  start: number; // absolute seconds on the timeline
  duration: number; // effective seconds (audio-aware)
  hasAudio: boolean;
  peaks: number[] | null; // audio waveform peaks 0..1 (~24/sec), null if no audio
}

export interface TimelineActor {
  uid: string;
  name: string;
  color: string;
}

export interface TimelineEditorProps {
  beats: TimelineBeat[];
  actors: TimelineActor[];
  totalDuration: number; // seconds (max end over all beats)
  currentTime: number; // playhead seconds
  selectedBeatId: string | null;
  playing: boolean;
  onSeek: (t: number) => void;
  onSelectBeat: (id: string) => void;
  onResizeBeat: (id: string, newDuration: number) => void;
  onMoveBeat: (id: string, newStart: number, newActorUid?: string) => void;
  pxPerSec?: number; // default 56
}

/** A beat as laid out (possibly with drag preview overrides applied). */
interface LayoutBeat extends TimelineBeat {
  layoutStart: number;
}

interface BeatBlockProps {
  beat: LayoutBeat;
  left: number; // px
  width: number; // px
  selected: boolean;
  dragging: boolean;
  previewDuration: number | undefined; // local resize override, if any
  onSelect: (id: string, start: number) => void;
  onMoveDown: (e: ReactPointerEvent<HTMLDivElement>, beat: LayoutBeat) => void;
  onMoveMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMoveEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeDown: (e: ReactPointerEvent<HTMLDivElement>, id: string, baseDur: number) => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers & constants                                                 */
/* ------------------------------------------------------------------ */

// Bengali numeral helper (same as elsewhere in the app).
const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const GUTTER_W = 112; // sticky-left actor-name column (matches w-28)
const DEFAULT_PPS = 56; // px per second
const MIN_DUR = 0.5; // seconds
const MAX_DUR = 20; // seconds
const MAX_START = 120; // seconds — hard timeline limit
const RULER_H = 26; // px
const ROW_H = 44; // px
const WAVE_MIN_WIDTH = 48; // px — skip waveform on narrower blocks

/** Fallback row for beats whose actorUid is not in `actors`. */
const OTHERS_ACTOR: TimelineActor = {
  uid: "__others__",
  name: "অন্যান্য",
  color: "#9ca3af",
};

/**
 * Snap a moved/extended beat into the nearest free gap of its actor track,
 * so two beats of the same character never overlap.
 */
function resolveOverlap(
  movingId: string,
  start: number,
  dur: number,
  all: TimelineBeat[],
  actorUid: string,
): number {
  const others = all
    .filter((b) => b.actorUid === actorUid && b.id !== movingId)
    .map((b) => ({ s: b.start, e: b.start + Math.max(MIN_DUR, b.duration) }))
    .sort((a, b) => a.s - b.s);
  let s = Math.max(0, start);
  for (let iter = 0; iter < 24; iter++) {
    let collided = false;
    for (const o of others) {
      if (s < o.e && s + dur > o.s) {
        // overlap → snap to the nearest side of the obstacle
        s = s + dur / 2 <= (o.s + o.e) / 2 ? o.s - dur - 0.05 : o.e + 0.05;
        collided = true;
      }
    }
    if (!collided) break;
  }
  return Math.max(0, Math.round(s * 20) / 20);
}

/* ------------------------------------------------------------------ */
/* Beat block (memoized — cheap during playhead re-renders)            */
/* ------------------------------------------------------------------ */

const BeatBlock = memo(function BeatBlock({
  beat,
  left,
  width,
  selected,
  dragging,
  previewDuration,
  onSelect,
  onMoveDown,
  onMoveMove,
  onMoveEnd,
  onResizeDown,
  onResizeMove,
  onResizeEnd,
}: BeatBlockProps) {
  const dur = previewDuration ?? Math.max(MIN_DUR, beat.duration);

  const peaks =
    beat.hasAudio && beat.peaks && beat.peaks.length > 0 && width >= WAVE_MIN_WIDTH
      ? beat.peaks
      : null;

  // Downsample peaks to thin 2px bars (2px bar + 1px gap each).
  const bars = useMemo(() => {
    if (!peaks) return null;
    const maxBars = Math.min(140, Math.floor((width - 8) / 3));
    if (maxBars < 4) return null;
    const step = peaks.length / maxBars;
    const out: number[] = [];
    for (let i = 0; i < maxBars; i++) {
      const p = peaks[Math.min(peaks.length - 1, Math.floor(i * step))] ?? 0;
      out.push(clamp(p, 0, 1));
    }
    return out;
  }, [peaks, width]);

  return (
    <div
      className={`absolute top-1 h-[36px] select-none touch-none overflow-hidden rounded-lg text-white ${
        selected ? "z-10 ring-2 ring-emerald-500" : ""
      } ${dragging ? "z-20 opacity-80 ring-2 ring-white/80" : "cursor-grab active:cursor-grabbing"}`}
      style={{ left, width }}
      onPointerDown={(e) => onMoveDown(e, beat)}
      onPointerMove={onMoveMove}
      onPointerUp={onMoveEnd}
      onPointerCancel={onMoveEnd}
      onClick={() => onSelect(beat.id, beat.layoutStart)}
    >
      {/* background tint (kept separate so text stays fully opaque) */}
      <div className="absolute inset-0" style={{ backgroundColor: beat.actorColor, opacity: 0.92 }} />

      <div className={`relative flex h-full items-center justify-between gap-1 px-2 ${bars ? "pb-2" : ""}`}>
        <span className="truncate text-[11px] font-bold leading-tight drop-shadow-sm">
          {beat.actionEmoji} {beat.actionLabel}
        </span>
        <span className="shrink-0 rounded bg-black/25 px-1 text-[10px] leading-4 opacity-90">
          {bnNum(dur.toFixed(1))}সে
        </span>
      </div>

      {bars && (
        <div className="pointer-events-none absolute inset-x-1 bottom-[3px] flex h-[12px] items-end gap-px overflow-hidden">
          {bars.map((p, i) => (
            <div
              key={i}
              className="w-[2px] shrink-0 rounded-full bg-white/70"
              style={{ height: 2 + p * 10 }}
            />
          ))}
        </div>
      )}

      {/* right-edge resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-2 touch-none cursor-ew-resize rounded-r-lg bg-black/10 hover:bg-black/25"
        onPointerDown={(e) => onResizeDown(e, beat.id, Math.max(MIN_DUR, beat.duration))}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* TimelineEditor                                                      */
/* ------------------------------------------------------------------ */

export default function TimelineEditor({
  beats,
  actors,
  totalDuration,
  currentTime,
  selectedBeatId,
  playing,
  onSeek,
  onSelectBeat,
  onResizeBeat,
  onMoveBeat,
  pxPerSec,
}: TimelineEditorProps) {
  const pps = pxPerSec && pxPerSec > 0 ? pxPerSec : DEFAULT_PPS;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  // Coordinate reference for all pointer math: the ruler's timed area shares
  // its rect with every row's timed area (same origin/width), and
  // getBoundingClientRect already accounts for the scroll offset.
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const scrubPointerRef = useRef<number | null>(null);

  const resizeDragRef = useRef<{
    id: string;
    startX: number;
    baseDur: number;
    maxDur: number;
    pointerId: number;
  } | null>(null);

  const moveDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origStart: number;
    origActorUid: string;
    dur: number;
    pointerId: number;
    rows: { uid: string; top: number; bottom: number }[];
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const [scrubbing, setScrubbing] = useState(false);
  const [resizePreview, setResizePreview] = useState<Record<string, number>>({});
  const movePreviewRef = useRef<{
    id: string;
    start: number;
    actorUid?: string;
  } | null>(null);
  const [movePreview, setMovePreview] = useState<{
    id: string;
    start: number;
    actorUid?: string;
  } | null>(null);

  const contentWidth = Math.max(totalDuration, 8) * pps + 80;

  /* Apply drag-preview overrides, then sort by start. */
  const layout = useMemo<LayoutBeat[]>(() => {
    const out = beats.map((b) => ({
      ...b,
      layoutStart: movePreview?.id === b.id ? movePreview.start : b.start,
    }));
    out.sort((a, b) => a.layoutStart - b.layoutStart);
    return out;
  }, [beats, movePreview]);

  /* Group beats per actor (with preview actor override); collect orphans. */
  const { byActor, orphanBeats } = useMemo(() => {
    const known = new Set(actors.map((a) => a.uid));
    const byActor = new Map<string, LayoutBeat[]>();
    const orphanBeats: LayoutBeat[] = [];
    for (const b of layout) {
      const effUid =
        movePreview?.id === b.id && movePreview.actorUid
          ? movePreview.actorUid
          : b.actorUid;
      if (known.has(effUid)) {
        const arr = byActor.get(effUid);
        if (arr) arr.push(b);
        else byActor.set(effUid, [b]);
      } else {
        orphanBeats.push(b);
      }
    }
    return { byActor, orphanBeats };
  }, [layout, actors, movePreview]);

  const displayActors = useMemo(
    () => (orphanBeats.length > 0 ? [...actors, OTHERS_ACTOR] : actors),
    [actors, orphanBeats]
  );

  const selectedInfo = useMemo(
    () => (selectedBeatId ? (layout.find((b) => b.id === selectedBeatId) ?? null) : null),
    [layout, selectedBeatId]
  );

  const tickCount = Math.max(1, Math.ceil(contentWidth / pps));

  /* ------------------------- seeking ------------------------- */

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = ticksRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left) / pps;
      onSeek(clamp(t, 0, Math.max(totalDuration, 0)));
    },
    [onSeek, pps, totalDuration]
  );

  const beginScrub = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      scrubPointerRef.current = e.pointerId;
      setScrubbing(true);
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const moveScrub = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (scrubPointerRef.current !== e.pointerId) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const endScrub = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubPointerRef.current !== e.pointerId) return;
    scrubPointerRef.current = null;
    setScrubbing(false);
  }, []);

  /* ------------------------- resizing ------------------------- */

  const onResizeDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, id: string, baseDur: number) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      // cap the extension at the next same-actor beat's start
      const self = beats.find((b) => b.id === id);
      const nextStart = self
        ? Math.min(
            ...beats
              .filter((b) => b.actorUid === self.actorUid && b.id !== id && b.start > self.start)
              .map((b) => b.start)
              .concat(MAX_DUR),
          )
        : MAX_DUR;
      const maxDur = clamp(nextStart - (self?.start ?? 0), MIN_DUR, MAX_DUR);
      resizeDragRef.current = { id, startX: e.clientX, baseDur, maxDur, pointerId: e.pointerId };
      setResizePreview((prev) => ({ ...prev, [id]: baseDur }));
    },
    [beats]
  );

  const onResizeMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = resizeDragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      const delta = (e.clientX - st.startX) / pps;
      const next = clamp(st.baseDur + delta, MIN_DUR, st.maxDur);
      setResizePreview((prev) => ({ ...prev, [st.id]: next }));
    },
    [pps]
  );

  const onResizeEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = resizeDragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      resizeDragRef.current = null;
      const delta = (e.clientX - st.startX) / pps;
      const next = Math.round(clamp(st.baseDur + delta, MIN_DUR, st.maxDur) * 10) / 10;
      setResizePreview((prev) => {
        if (prev[st.id] === undefined) return prev;
        const copy = { ...prev };
        delete copy[st.id];
        return copy;
      });
      onResizeBeat(st.id, next);
    },
    [onResizeBeat, pps]
  );

  /* ------------------------- moving (drag) ------------------------- */

  const collectRows = useCallback(() => {
    const el = rowsRef.current;
    if (!el) return [];
    const out: { uid: string; top: number; bottom: number }[] = [];
    el.querySelectorAll<HTMLElement>("[data-actor]").forEach((row) => {
      const uid = row.dataset.actor;
      if (!uid) return;
      const rect = row.getBoundingClientRect();
      out.push({ uid, top: rect.top, bottom: rect.bottom });
    });
    return out;
  }, []);

  const onMoveDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, beat: LayoutBeat) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      moveDragRef.current = {
        id: beat.id,
        startX: e.clientX,
        startY: e.clientY,
        origStart: beat.layoutStart,
        origActorUid: beat.actorUid,
        dur: Math.max(MIN_DUR, beat.duration),
        pointerId: e.pointerId,
        rows: collectRows(),
        moved: false,
      };
    },
    [collectRows]
  );

  const onMoveMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = moveDragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      if (!st.moved && Math.abs(e.clientX - st.startX) < 4 && Math.abs(e.clientY - st.startY) < 4) {
        return; // treat as a click until real movement
      }
      st.moved = true;
      suppressClickRef.current = true;
      const dx = (e.clientX - st.startX) / pps;
      let nextStart = clamp(st.origStart + dx, 0, MAX_START);
      // which row are we over?
      let targetUid = st.origActorUid;
      for (const row of st.rows) {
        if (e.clientY >= row.top && e.clientY <= row.bottom) {
          targetUid = row.uid;
          break;
        }
      }
      if (targetUid === OTHERS_ACTOR.uid) targetUid = st.origActorUid;
      // keep the same-actor track collision-free while previewing
      nextStart = resolveOverlap(st.id, nextStart, st.dur, beats, targetUid);
      movePreviewRef.current = {
        id: st.id,
        start: nextStart,
        actorUid: targetUid !== st.origActorUid ? targetUid : undefined,
      };
      setMovePreview(movePreviewRef.current);
    },
    [beats, pps]
  );

  const onMoveEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = moveDragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      moveDragRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      const preview = movePreviewRef.current;
      movePreviewRef.current = null;
      setMovePreview(null);
      if (!st.moved) return;
      if (preview && preview.id === st.id) {
        const changed =
          Math.abs(preview.start - st.origStart) > 0.01 ||
          (preview.actorUid !== undefined && preview.actorUid !== st.origActorUid);
        if (changed) {
          onMoveBeat(
            st.id,
            preview.start,
            preview.actorUid !== undefined && preview.actorUid !== st.origActorUid
              ? preview.actorUid
              : undefined,
          );
        }
      }
    },
    [onMoveBeat]
  );

  /* ------------------------- selecting ------------------------- */

  const onSelectBeatAt = useCallback(
    (id: string, start: number) => {
      if (suppressClickRef.current) return;
      onSelectBeat(id);
      onSeek(start + 0.01);
    },
    [onSelectBeat, onSeek]
  );

  /* --------------------- auto-scroll while playing --------------------- */

  useEffect(() => {
    if (!playing) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = currentTime * pps; // playhead in timed-area coords
    const viewW = el.clientWidth - GUTTER_W; // visible timed-area width
    if (viewW <= 0) return;
    const margin = 40;
    if (x < el.scrollLeft) {
      el.scrollLeft = Math.max(0, x - margin);
    } else if (x > el.scrollLeft + viewW - margin) {
      el.scrollLeft = Math.max(0, x - viewW + margin);
    }
  }, [currentTime, playing, pps]);

  /* ------------------------- render ------------------------- */

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* header */}
      <div className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-2.5">
        <h3 className="text-sm font-bold text-orange-800">
          🎞️ টাইমলাইন <span className="hidden text-[11px] font-medium text-amber-600 sm:inline">(মাল্টি-ট্র্যাক — সবাই একসাথে অভিনয় করতে পারে!)</span>
        </h3>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-amber-700">
            মোট: {bnNum(totalDuration.toFixed(1))} সে.
          </span>
          <span className="hidden text-[11px] text-amber-600 md:block">
            ব্লক টেনে সময় বদলান • অন্য সারিতে টানলে ক্যারেক্টর বদলাবে • কিনারা টেনে দৈর্ঘ্য
          </span>
        </div>
      </div>

      {/* selected beat info strip */}
      {selectedInfo && (
        <div className="px-3 pb-1.5">
          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            বাছাইকৃত: {selectedInfo.actionEmoji} {selectedInfo.actionLabel} —{" "}
            {bnNum(selectedInfo.layoutStart.toFixed(1))} সে. থেকে{" "}
            {bnNum(Math.max(MIN_DUR, selectedInfo.duration).toFixed(1))} সে. ধরে
          </span>
        </div>
      )}

      {beats.length === 0 ? (
        /* empty state */
        <div className="px-3 pb-3">
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50/40 px-4">
            <p className="text-center text-sm text-amber-600">
              এখনো কোনো দৃশ্য নেই — নিচের ফর্ম থেকে দৃশ্য যোগ করুন 🎬
            </p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain pb-1">
          <div className="relative" style={{ width: GUTTER_W + contentWidth }}>
            {/* ruler row */}
            <div className="sticky top-0 z-20 flex bg-white/95 backdrop-blur">
              <div
                className="w-28 shrink-0 border-r border-amber-200 bg-white/95"
                style={{ height: RULER_H }}
              />
              <div
                ref={ticksRef}
                className="relative touch-none select-none"
                style={{ width: contentWidth, height: RULER_H }}
                onPointerDown={beginScrub}
                onPointerMove={moveScrub}
                onPointerUp={endScrub}
                onPointerCancel={endScrub}
              >
                {Array.from({ length: tickCount }, (_, s) => {
                  const major = s % 5 === 0;
                  return (
                    <div key={s} className="absolute top-0" style={{ left: s * pps }}>
                      <div
                        className={
                          major ? "h-3.5 border-l border-amber-400" : "h-2 border-l border-amber-300"
                        }
                      />
                      <div
                        className={`ml-1 text-[10px] leading-none ${
                          major ? "font-bold text-amber-800" : "text-amber-600"
                        }`}
                      >
                        {bnNum(s)}
                        {s === 0 ? " সে" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* actor rows */}
            <div ref={rowsRef}>
              {displayActors.map((actor) => {
                const rowBeats =
                  actor.uid === OTHERS_ACTOR.uid
                    ? orphanBeats
                    : (byActor.get(actor.uid) ?? []);
                return (
                  <div
                    key={actor.uid}
                    data-actor={actor.uid}
                    className="flex border-t border-amber-100"
                    style={{ height: ROW_H }}
                  >
                    {/* sticky name gutter */}
                    <div className="sticky left-0 z-20 flex w-28 shrink-0 items-center gap-1.5 border-r border-amber-200 bg-white px-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: actor.color }}
                      />
                      <span className="truncate text-xs font-bold text-amber-900">{actor.name}</span>
                    </div>
                    {/* timed area */}
                    <div
                      className="relative shrink-0 touch-none"
                      style={{ width: contentWidth }}
                      onPointerDown={beginScrub}
                      onPointerMove={moveScrub}
                      onPointerUp={endScrub}
                      onPointerCancel={endScrub}
                    >
                      {rowBeats.map((b) => (
                        <BeatBlock
                          key={b.id}
                          beat={b}
                          left={b.layoutStart * pps}
                          width={(resizePreview[b.id] ?? Math.max(MIN_DUR, b.duration)) * pps - 4}
                          selected={b.id === selectedBeatId}
                          dragging={movePreview?.id === b.id}
                          previewDuration={resizePreview[b.id]}
                          onSelect={onSelectBeatAt}
                          onMoveDown={onMoveDown}
                          onMoveMove={onMoveMove}
                          onMoveEnd={onMoveEnd}
                          onResizeDown={onResizeDown}
                          onResizeMove={onResizeMove}
                          onResizeEnd={onResizeEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* playhead */}
            <div
              className="pointer-events-none absolute inset-y-0 z-30"
              style={{ left: GUTTER_W, width: contentWidth }}
            >
              <div
                className={`absolute bottom-0 top-0 w-0.5 bg-rose-500 ${scrubbing ? "transition-none" : ""}`}
                style={{ left: Math.max(0, currentTime * pps - 1) }}
              >
                <div
                  aria-label="প্লেহেড"
                  className={`pointer-events-auto absolute -left-[6px] top-[3px] h-3.5 w-3.5 touch-none rounded-full border-2 border-white bg-rose-500 shadow ${
                    scrubbing ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onPointerDown={beginScrub}
                  onPointerMove={moveScrub}
                  onPointerUp={endScrub}
                  onPointerCancel={endScrub}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
