// ============================================================
// ঠাট্টা স্টুডিও — Sprint 7: deterministic offline video exporter
//
// Prime path (Chrome/Edge/Safari/Firefox with WebCodecs):
//   • every frame is rendered at an exact timestep (no dropped frames,
//     no tab-visible requirement, no realtime dependency)
//   • H.264 video + AAC/Opus audio muxed into a real .mp4 (mp4-muxer)
//   • all TTS voices are mixed with OfflineAudioContext at exact beat
//     times — perfectly synced dialogue, even for parallel tracks
// Fallback: the studio's realtime MediaRecorder path stays as-is.
// ============================================================

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

// ---------- minimal WebCodecs typings (runtime-checked, no `any`) ----------

interface VideoEncoderLike {
  configure(config: Record<string, unknown>): void;
  encode(frame: unknown, opts?: { keyFrame?: boolean }): void;
  flush(): Promise<void>;
  close(): void;
  readonly encodeQueueSize: number;
}
interface VideoEncoderCtor {
  new (init: {
    output: (chunk: unknown, meta: unknown) => void;
    error: (e: unknown) => void;
  }): VideoEncoderLike;
  isConfigSupported(config: Record<string, unknown>): Promise<{ supported?: boolean }>;
}
interface AudioEncoderLike {
  configure(config: Record<string, unknown>): void;
  encode(data: unknown): void;
  flush(): Promise<void>;
  close(): void;
  readonly encodeQueueSize: number;
}
interface AudioEncoderCtor {
  new (init: {
    output: (chunk: unknown, meta: unknown) => void;
    error: (e: unknown) => void;
  }): AudioEncoderLike;
  isConfigSupported(config: Record<string, unknown>): Promise<{ supported?: boolean }>;
}
interface VideoFrameLike {
  close(): void;
}
interface VideoFrameCtor {
  new (
    source: HTMLCanvasElement,
    init: { timestamp: number; duration?: number },
  ): VideoFrameLike;
}
interface AudioDataLike {
  close(): void;
}
interface AudioDataCtor {
  new (init: {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: Float32Array;
  }): AudioDataLike;
}

function codecs(): {
  VideoEncoder?: VideoEncoderCtor;
  AudioEncoder?: AudioEncoderCtor;
  VideoFrame?: VideoFrameCtor;
  AudioData?: AudioDataCtor;
} {
  const g = globalThis as unknown as Record<string, unknown>;
  return {
    VideoEncoder: g.VideoEncoder as VideoEncoderCtor | undefined,
    AudioEncoder: g.AudioEncoder as AudioEncoderCtor | undefined,
    VideoFrame: g.VideoFrame as VideoFrameCtor | undefined,
    AudioData: g.AudioData as AudioDataCtor | undefined,
  };
}

/** WebCodecs MP4 export available in this browser? */
export function webCodecsAvailable(): boolean {
  const c = codecs();
  return typeof c.VideoEncoder === 'function' && typeof c.VideoFrame === 'function';
}

// ---------- public API ----------

/**
 * One mono audio event on the export timeline. Phase 4: every bus
 * (dialogue, SFX, background music) is just {start, url, volume} —
 * all of them go through the same offline mixdown.
 */
export interface ExportBeatAudio {
  /** absolute start (seconds) on the export timeline */
  start: number;
  /** playable URL (blob URL for procedural/procedurally-processed audio) */
  url: string;
  /** linear loudness 0..1.5 (default 1) */
  volume?: number;
}

export interface ExportOptions {
  fps: number;
  width: number;
  height: number;
  /** H.264 bitrate in bits/second */
  bitrate: number;
  /** hide the floating speaker name pills for a clean picture */
  hideNameTags: boolean;
  /** fade from black at the start, fade to black at the end */
  fadeInOut: boolean;
  /** optional title card text (Bangla) shown for ~1.8s at the start */
  titleText: string;
  /**
   * Phase 6 — বাংলা সাবটাইটেল বার্ন-ইন: dialogue lines on the EPISODE
   * timeline (seconds, after the title card). When present, the engine's
   * own speech subtitles are suppressed and this clean cinema-style bar
   * is burned into every frame instead.
   */
  subtitles?: ExportSubtitle[];
  onProgress?: (done: number, total: number, phase: string) => void;
  cancelled?: () => boolean;
}

/** one burned-in subtitle cue (Phase 6) */
export interface ExportSubtitle {
  /** start on the episode timeline (seconds) */
  start: number;
  /** end (exclusive) */
  end: number;
  text: string;
}

export interface ExportResult {
  blob: Blob;
  ext: 'mp4';
  mode: 'webcodecs';
}

export class ExportCancelled extends Error {
  constructor() {
    super('export cancelled');
  }
}

const TITLE_CARD_SECONDS = 1.8;

/**
 * Render the whole scene frame-by-frame and mux to MP4.
 * `renderFrame(t)` receives the absolute scene time for each frame
 * (it renders into `canvas` at its internal resolution).
 */
export async function exportVideoWebCodecs(
  canvas: HTMLCanvasElement,
  renderFrame: (t: number) => void,
  totalSeconds: number,
  audioBuses: ExportBeatAudio[],
  opts: ExportOptions,
): Promise<ExportResult> {
  const { VideoEncoder: VE, AudioEncoder: AE, VideoFrame: VF, AudioData: AD } = codecs();
  if (!VE || !VF) throw new Error('WebCodecs is not available in this browser');
  if (!(totalSeconds > 0)) throw new Error('কার্টুনের দৈর্ঘ্য শূন্য');

  const fps = Math.max(12, Math.min(60, Math.round(opts.fps)));
  const cardDur = opts.titleText.trim() ? TITLE_CARD_SECONDS : 0;
  const subs = (opts.subtitles ?? []).filter((c) => c.text.trim().length > 0);
  const sceneFrames = Math.max(1, Math.ceil(totalSeconds * fps) + Math.round(fps * 0.4));
  const cardFrames = Math.round(cardDur * fps);
  const totalFrames = cardFrames + sceneFrames;
  const totalVideoSeconds = totalFrames / fps;

  // ---- pick codecs the browser actually supports ----
  const candidates = ['avc1.640028', 'avc1.4D0028', 'avc1.42E01F', 'avc1.420032'];
  let videoCodec: string | null = null;
  for (const codec of candidates) {
    try {
      const s = await VE.isConfigSupported({
        codec,
        width: opts.width,
        height: opts.height,
        bitrate: opts.bitrate,
        framerate: fps,
      });
      if (s.supported) {
        videoCodec = codec;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!videoCodec) throw new Error('এই ব্রাউজারে H.264 এনকোডার নেই');

  let audioCodec: 'aac' | 'opus' | null = null;
  if (AE) {
    const audioCandidates: { codec: string; label: 'aac' | 'opus' }[] = [
      { codec: 'mp4a.40.2', label: 'aac' },
      { codec: 'opus', label: 'opus' },
    ];
    for (const c of audioCandidates) {
      try {
        const s = await AE.isConfigSupported({
          codec: c.codec,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitrate: 96_000,
        });
        if (s.supported) {
          audioCodec = c.label;
          break;
        }
      } catch {
        /* try next */
      }
    }
  }

  // ---- muxer ----
  interface MuxerOpts {
    target: ArrayBufferTarget;
    video: { codec: 'avc'; width: number; height: number; frameRate: number };
    audio?: { codec: 'aac' | 'opus'; numberOfChannels: number; sampleRate: number };
    fastStart: 'in-memory';
  }
  const muxerOpts: MuxerOpts = {
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: opts.width, height: opts.height, frameRate: fps },
    fastStart: 'in-memory',
  };
  if (audioCodec) {
    muxerOpts.audio = { codec: audioCodec, numberOfChannels: 1, sampleRate: 48000 };
  }
  const muxer = new Muxer(muxerOpts as unknown as ConstructorParameters<typeof Muxer>[0]);

  let encoderError: Error | null = null;
  const onEncoderError = (e: unknown) => {
    encoderError =
      e instanceof Error ? e : new Error('encoder failed — try the realtime mode');
  };

  // ---- audio track: mix every voice at its exact beat time ----
  if (audioCodec && AE && AD && audioBuses.length > 0) {
    opts.onProgress?.(0, totalFrames, 'অডিও মিক্স হচ্ছে');
    const sampleRate = 48000;
    const audioBuf = await mixDialogue(audioBuses, totalVideoSeconds, sampleRate);
    const audioEncoder = new AE({
      output: (c, m) =>
        muxer.addAudioChunk(
          c as unknown as EncodedAudioChunk,
          m as EncodedAudioChunkMetadata | undefined,
        ),
      error: onEncoderError,
    });
    audioEncoder.configure({
      codec: audioCodec === 'aac' ? 'mp4a.40.2' : 'opus',
      sampleRate,
      numberOfChannels: 1,
      bitrate: 96_000,
    });
    const mono = audioBuf.getChannelData(0);
    const CHUNK = 960; // 20ms @48k — safe for both AAC and Opus
    for (let off = 0; off < mono.length; off += CHUNK) {
      if (encoderError) break;
      if (opts.cancelled?.()) {
        audioEncoder.close();
        throw new ExportCancelled();
      }
      const n = Math.min(CHUNK, mono.length - off);
      const slice = new Float32Array(n);
      slice.set(mono.subarray(off, off + n));
      const data = new AD({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: n,
        numberOfChannels: 1,
        timestamp: Math.round((off / sampleRate) * 1e6),
        data: slice,
      });
      audioEncoder.encode(data);
      data.close();
      if (audioEncoder.encodeQueueSize > 24) await yieldFrame();
    }
    await audioEncoder.flush();
    audioEncoder.close();
  }
  if (encoderError) throw encoderError;

  // ---- video track: deterministic frame stepping ----
  const out = document.createElement('canvas');
  out.width = opts.width;
  out.height = opts.height;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D unavailable');

  const videoEncoder = new VE({
    output: (c, m) =>
      muxer.addVideoChunk(
        c as unknown as EncodedVideoChunk,
        m as EncodedVideoChunkMetadata | undefined,
      ),
    error: onEncoderError,
  });
  videoEncoder.configure({
    codec: videoCodec,
    width: opts.width,
    height: opts.height,
    bitrate: opts.bitrate,
    framerate: fps,
    latencyMode: 'quality',
  });

  const frameDurUs = Math.round(1e6 / fps);
  const fadeT = 0.45; // fade-in length (s)
  const fadeEnd = 0.6; // fade-out length (s)

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError;
      if (opts.cancelled?.()) throw new ExportCancelled();

      const videoTime = i / fps;
      const sceneT = Math.max(0, videoTime - cardDur);
      renderFrame(sceneT);
      octx.drawImage(canvas, 0, 0, opts.width, opts.height);

      // title card over the first frames
      if (cardFrames > 0 && i < cardFrames) {
        drawTitleCard(octx, opts.titleText.trim(), videoTime, cardDur, opts.width, opts.height);
      } else {
        // Phase 6 — burned-in Bangla subtitle bar (scales with resolution)
        if (subs.length > 0) {
          const cue = subs.find((c) => sceneT >= c.start && sceneT < c.end);
          if (cue) {
            drawSubtitleBar(
              octx,
              cue.text,
              (sceneT - cue.start) / Math.max(0.001, cue.end - cue.start),
              opts.width,
              opts.height,
            );
          }
        }
        if (opts.fadeInOut) {
          let black = 0;
          if (videoTime < fadeT) black = 1 - videoTime / fadeT;
          const remain = totalVideoSeconds - videoTime;
          if (remain < fadeEnd) black = Math.max(black, 1 - remain / fadeEnd);
          if (black > 0.001) {
            octx.save();
            octx.globalAlpha = Math.min(1, black);
            octx.fillStyle = '#000';
            octx.fillRect(0, 0, opts.width, opts.height);
            octx.restore();
          }
        }
      }

      const frame = new VF(out, {
        timestamp: i * frameDurUs,
        duration: frameDurUs,
      });
      videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      // keep the UI breathing + avoid runaway encoder queues
      if (videoEncoder.encodeQueueSize > 8) await waitFor(videoEncoder);
      if (i % 4 === 0) await yieldFrame();
      if (i % 10 === 0) opts.onProgress?.(i, totalFrames, 'ভিডিও রেন্ডার হচ্ছে');
    }
    opts.onProgress?.(totalFrames, totalFrames, 'চূড়ান্ত প্যাকেজিং');
    await videoEncoder.flush();
  } finally {
    videoEncoder.close();
  }
  if (encoderError) throw encoderError;

  muxer.finalize();
  const { buffer } = muxer.target as unknown as { buffer: ArrayBuffer };
  return {
    blob: new Blob([buffer], { type: 'video/mp4' }),
    ext: 'mp4',
    mode: 'webcodecs',
  };
}

// ---------- helpers ----------

function yieldFrame(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function waitFor(encoder: VideoEncoderLike): Promise<void> {
  return new Promise((r) => {
    const tick = () => (encoder.encodeQueueSize > 4 ? setTimeout(tick, 8) : r());
    tick();
  });
}

/** Mix every bus (dialogue + SFX + music) into one mono AudioBuffer. */
async function mixDialogue(
  buses: ExportBeatAudio[],
  totalSeconds: number,
  sampleRate: number,
): Promise<AudioBuffer> {
  const OfflineAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineAC) throw new Error('OfflineAudioContext unavailable');
  const ctx = new OfflineAC(
    1,
    Math.ceil((totalSeconds + 0.25) * sampleRate),
    sampleRate,
  );
  for (const bus of buses) {
    try {
      const res = await fetch(bus.url);
      const ab = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      // per-bus loudness (SFX volume, music loudness…)
      const g = ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1.5, bus.volume ?? 1));
      src.connect(g).connect(ctx.destination);
      src.start(Math.max(0, bus.start));
    } catch {
      /* a broken voice line must never kill the export */
    }
  }
  return ctx.startRendering();
}

/** premium title card — warm amber, studio branding, gentle fade */
function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  t: number,
  dur: number,
  w: number,
  h: number,
) {
  const alpha = Math.min(1, t / 0.35, Math.max(0, dur - t) / 0.45);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(0, 0, w, h);

  // decorative sun + ground motif
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.34, h * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdba74';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = '#86efac';
  ctx.fillRect(0, h * 0.78, w, 10);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9a3412';
  ctx.font = `700 ${Math.round(h * 0.14)}px "Hind Siliguri", sans-serif`;
  ctx.fillText(clipText(ctx, title, w * 0.86), w / 2, h * 0.46);
  ctx.fillStyle = '#c2410c';
  ctx.font = `600 ${Math.round(h * 0.055)}px "Hind Siliguri", sans-serif`;
  ctx.fillText('🎬 ঠাট্টা স্টুডিও', w / 2, h * 0.6);
  ctx.restore();
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

/** word-wrap for the burned subtitle bar (Bangla-friendly, up to 2 lines) */
function wrapCue(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    // squeeze into exactly two ellipsized lines
    const joined = lines.join(' ');
    let a = joined;
    while (a.length > 1 && ctx.measureText(a + '…').width > maxW) a = a.slice(0, -1);
    return [a + '…'];
  }
  return lines;
}

/**
 * Phase 6 — clean cinema subtitle bar: translucent black band + white
 * Bangla text + a subtle 1-frame-in fade. Scales with the render size.
 */
function drawSubtitleBar(
  ctx: CanvasRenderingContext2D,
  text: string,
  /** 0..1 progress inside the cue (drives the soft fade) */
  progress: number,
  w: number,
  h: number,
) {
  const fade = Math.min(1, Math.min(progress / 0.12, (1 - progress) / 0.12));
  const fontSize = Math.round(h * 0.045);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fade));
  ctx.font = `600 ${fontSize}px "Hind Siliguri", sans-serif`;
  const maxW = w * 0.82;
  const lines = wrapCue(ctx, text.trim(), maxW);
  const lh = fontSize * 1.4;
  const barH = lines.length * lh + h * 0.026;
  const barY = h - barH - h * 0.024;
  ctx.fillStyle = 'rgba(8, 6, 4, 0.62)';
  ctx.beginPath();
  ctx.roundRect(0, barY, w, barH, Math.min(w * 0.02, 18));
  ctx.fill();
  ctx.fillStyle = '#fffdf5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, barY + h * 0.013 + lh / 2 + i * lh);
  });
  ctx.restore();
}
