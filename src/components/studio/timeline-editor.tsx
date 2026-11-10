"use client";

/**
 * টাইমলাইন এডিটর (Timeline Editor) — ঠাট্টা স্টুডিও
 *
 * Horizontal, beat-based timeline for visualizing and scrubbing a cartoon
 * scene like a video editor. Purely presentational: no store/engine imports,
 * React + Tailwind only.
 *
 * Interactions:
 *  - Click / drag on the ruler or empty row space  → seek (onSeek)
 *  - Click on a beat block                          → select + seek to its start
 *  - Drag the right edge of a beat block            → resize (0.5s..20s, committed on pointerup)
 *  - Drag the red playhead knob                     → scrub
 *  - While `playing`, the view auto-follows the playhead
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
  totalDuration: number; // seconds (sum of beat durations, min 6)
  currentTime: number; // playhead seconds
  selectedBeatId: string | null;
  playing: boolean;
  onSeek: (t: number) => void;
  onSelectBeat: (id: string) => void;
  onResizeBeat: (id: string, newDuration: number) => void; // drag right edge; clamp 0.5..20
  pxPerSec?: number; // default 56
}

/** A beat plus its computed sequential start time (seconds). */
interface LayoutBeat extends TimelineBeat {
  start: number;
}

interface BeatBlockProps {
  beat: LayoutBeat;
  left: number; // px
  width: number; // px
  selected: boolean;
  previewDuration: number | undefined; // local resize override, if any
  onSelect: (id: string, start: number) => void;
  onResizeDown: (e: ReactPointerEvent<HTMLDivElement>, id: string, baseDur: number) => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers & constants                                                 */
/* ------------------------------------------------------------------ */

// Bengali numeral helper (same as elsewhere in the app).
const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const GUTTER_W = 112; // sticky-left actor-name column (matches w-28)
const DEFAULT_PPS = 56; // px per second
const MIN_DUR = 0.5; // seconds
const MAX_DUR = 20; // seconds
const RULER_H = 26; // px
const ROW_H = 44; // px
const WAVE_MIN_WIDTH = 48; // px — skip waveform on narrower blocks

/** Fallback row for beats whose actorUid is not in `actors`. */
const OTHERS_ACTOR: TimelineActor = {
  uid: "__others__",
  name: "অন্যান্য",
  color: "#9ca3af",
};

/* ------------------------------------------------------------------ */
/* Beat block (memoized — cheap during playhead re-renders)            */
/* ------------------------------------------------------------------ */

const BeatBlock = memo(function BeatBlock({
  beat,
  left,
  width,
  selected,
  previewDuration,
  onSelect,
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
      className={`absolute top-1 h-[36px] select-none overflow-hidden rounded-lg text-white ${
        selected ? "z-10 ring-2 ring-emerald-500" : ""
      }`}
      style={{ left, width }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect(beat.id, beat.start)}
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
  pxPerSec,
}: TimelineEditorProps) {
  const pps = pxPerSec && pxPerSec > 0 ? pxPerSec : DEFAULT_PPS;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Coordinate reference for all pointer math: the ruler's timed area shares
  // its rect with every row's timed area (same origin/width), and
  // getBoundingClientRect already accounts for the scroll offset.
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const scrubPointerRef = useRef<number | null>(null);
  const resizeDragRef = useRef<{
    id: string;
    startX: number;
    baseDur: number;
    pointerId: number;
  } | null>(null);

  const [scrubbing, setScrubbing] = useState(false);
  const [resizePreview, setResizePreview] = useState<Record<string, number>>({});

  const contentWidth = Math.max(totalDuration, 8) * pps + 80;

  /* Sequential layout: beat i starts at the sum of previous effective durations. */
  const layout = useMemo(
    () =>
      beats
        .reduce<{ out: LayoutBeat[]; acc: number }>(
          (state, b) => {
            state.out.push({ ...b, start: state.acc });
            state.acc += Math.max(MIN_DUR, b.duration);
            return state;
          },
          { out: [], acc: 0 },
        )
        .out.slice(),
    [beats],
  );

  /* Group beats per actor; collect orphans (unknown actorUid) for the "অন্যান্য" row. */
  const { byActor, orphanBeats } = useMemo(() => {
    const known = new Set(actors.map((a) => a.uid));
    const byActor = new Map<string, LayoutBeat[]>();
    const orphanBeats: LayoutBeat[] = [];
    for (const b of layout) {
      if (known.has(b.actorUid)) {
        const arr = byActor.get(b.actorUid);
        if (arr) arr.push(b);
        else byActor.set(b.actorUid, [b]);
      } else {
        orphanBeats.push(b);
      }
    }
    return { byActor, orphanBeats };
  }, [layout, actors]);

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
      resizeDragRef.current = { id, startX: e.clientX, baseDur, pointerId: e.pointerId };
      setResizePreview((prev) => ({ ...prev, [id]: baseDur }));
    },
    []
  );

  const onResizeMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = resizeDragRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      const delta = (e.clientX - st.startX) / pps;
      const next = clamp(st.baseDur + delta, MIN_DUR, MAX_DUR);
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
      const next = clamp(st.baseDur + delta, MIN_DUR, MAX_DUR);
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

  /* ------------------------- selecting ------------------------- */

  const onSelectBeatAt = useCallback(
    (id: string, start: number) => {
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
        <h3 className="text-sm font-bold text-orange-800">🎞️ টাইমলাইন</h3>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-amber-700">
            মোট: {bnNum(totalDuration.toFixed(1))} সে.
          </span>
          <span className="hidden text-[11px] text-amber-600 sm:block">
            ক্লিক = সময় বদল • কিনারা টেনে = দৈর্ঘ্য • ক্যারেক্টার টেনে = সরান
          </span>
        </div>
      </div>

      {/* selected beat info strip */}
      {selectedInfo && (
        <div className="px-3 pb-1.5">
          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            বাছাইকৃত: {selectedInfo.actionEmoji} {selectedInfo.actionLabel} —{" "}
            {bnNum(selectedInfo.start.toFixed(1))} সে. থেকে শুরু
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
            {displayActors.map((actor) => {
              const rowBeats =
                actor.uid === OTHERS_ACTOR.uid
                  ? orphanBeats
                  : (byActor.get(actor.uid) ?? []);
              return (
                <div key={actor.uid} className="flex border-t border-amber-100" style={{ height: ROW_H }}>
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
                        left={b.start * pps}
                        width={(resizePreview[b.id] ?? Math.max(MIN_DUR, b.duration)) * pps - 4}
                        selected={b.id === selectedBeatId}
                        previewDuration={resizePreview[b.id]}
                        onSelect={onSelectBeatAt}
                        onResizeDown={onResizeDown}
                        onResizeMove={onResizeMove}
                        onResizeEnd={onResizeEnd}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

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
