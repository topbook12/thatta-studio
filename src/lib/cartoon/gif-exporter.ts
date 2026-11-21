// ============================================================
// ঠাট্টা স্টুডিও — Phase 6: GIF export (সোশ্যাল মিডিয়া)
//
// Renders the episode (or a single scene) through the same
// deterministic frame pipeline as the MP4 exporter, then encodes
// an animated GIF with gifenc (pure JS, offline, no workers).
//
// GIFs are downscaled + capped in length to keep the file small:
//   default 480×270 @ 12fps, max 10 seconds.
// ============================================================

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface GifExportOptions {
  /** GIF frame rate (8..15 recommended; default 12) */
  fps?: number;
  /** output width (height follows 16:9; default 480) */
  width?: number;
  /** hard cap on animated seconds (default 10) */
  maxSeconds?: number;
  onProgress?: (done: number, total: number, phase: string) => void;
  cancelled?: () => boolean;
}

/**
 * Render every frame via `renderFrame(t)` into `canvas`, then encode a
 * GIF. `totalSeconds` is the FULL length; if it exceeds `maxSeconds`
 * only the first `maxSeconds` are encoded (the caller should warn).
 */
export async function exportGif(
  canvas: HTMLCanvasElement,
  renderFrame: (t: number) => void,
  totalSeconds: number,
  opts: GifExportOptions = {},
): Promise<Blob> {
  const fps = Math.max(8, Math.min(15, Math.round(opts.fps ?? 12)));
  const width = Math.max(160, Math.min(640, Math.round(opts.width ?? 480)));
  const height = Math.round((width * 9) / 16);
  const maxSeconds = Math.max(1, Math.min(15, opts.maxSeconds ?? 10));
  const seconds = Math.min(totalSeconds, maxSeconds);
  if (!(seconds > 0)) throw new Error('কার্টুনের দৈর্ঘ্য শূন্য');

  const totalFrames = Math.max(2, Math.round(seconds * fps));
  const gif = GIFEncoder();

  // offscreen downscale target
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('Canvas 2D unavailable');

  const delay = Math.round(1000 / fps);

  for (let i = 0; i < totalFrames; i++) {
    if (opts.cancelled?.()) throw new Error('export cancelled');
    const t = i / fps;
    renderFrame(t);
    octx.drawImage(canvas, 0, 0, width, height);

    const { data } = octx.getImageData(0, 0, width, height);
    // per-frame palette keeps colors faithful across scene changes
    const palette = quantize(data, 256, { format: 'rgb565' });
    const index = applyPalette(data, palette, 'rgb565');
    gif.writeFrame(index, width, height, { palette, delay });

    if (i % 3 === 0) {
      opts.onProgress?.(i, totalFrames, 'GIF তৈরি হচ্ছে');
      // let the UI breathe (quantize is CPU-heavy)
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  gif.finish();
  opts.onProgress?.(totalFrames, totalFrames, 'প্যাকেজিং');
  const bytes = gif.bytesView();
  return new Blob([bytes.slice()], { type: 'image/gif' });
}
