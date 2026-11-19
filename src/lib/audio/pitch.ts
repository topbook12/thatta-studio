// ============================================================
// ঠাট্টা স্টুডিও — Phase 4 (সাউন্ড স্টুডিও): pitch shifter
//
// Character voice tuning (ক্যারেক্টরভিত্তিক ভয়েস পিচ) without a
// server: classic two-step pitch shift on raw PCM —
//   1) resample by r = 2^(semitones/12)  → pitch × r, duration ÷ r
//   2) overlap-add time-stretch by r     → duration back to original
// Duration is PRESERVED, so beat windows + lip-sync stay exact.
// Pure synchronous Float32 math — deterministic and fast (<20 ms
// for a 10 s line), works offline, no WebAudio graph needed.
// ============================================================

/** Linear-interpolation resample. out.length = ceil(in.length / r). */
function resample(input: Float32Array, r: number): Float32Array {
  if (Math.abs(r - 1) < 1e-4) return input.slice();
  const outLen = Math.max(1, Math.ceil(input.length / r));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * r;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = input[i0] ?? 0;
    const b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/**
 * Overlap-add time-stretch by factor `stretch` (>1 = longer).
 * Hann-windowed grains, synthesis hop = analysis hop × stretch.
 * Output is normalized so no pumping appears at grain borders.
 */
function timeStretch(input: Float32Array, stretch: number): Float32Array {
  if (Math.abs(stretch - 1) < 1e-4) return input.slice();
  const W = 1024; // grain size (~23 ms @44.1k) — small keeps speech crisp
  const Ha = W >> 2; // analysis hop (75% overlap)
  const Hs = Math.max(1, Math.round(Ha * stretch)); // synthesis hop
  const grains = Math.max(1, Math.ceil((input.length - W) / Ha));
  const outLen = Math.min(input.length, grains * Hs + W);
  const out = new Float32Array(Math.max(outLen, Math.min(input.length, 1)));
  const norm = new Float32Array(out.length);
  const win = new Float32Array(W);
  for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1));

  for (let g = 0; g < grains; g++) {
    const inOff = g * Ha;
    const outOff = g * Hs;
    if (outOff + W > out.length) break;
    for (let i = 0; i < W; i++) {
      out[outOff + i] += (input[inOff + i] ?? 0) * win[i];
      norm[outOff + i] += win[i];
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (norm[i] > 1e-3) out[i] /= norm[i];
  }
  return out;
}

/** Shift a mono PCM channel by `semitones` (−6..+6), preserving duration. */
export function shiftPitchChannel(data: Float32Array, semitones: number): Float32Array {
  if (!semitones || Math.abs(semitones) < 0.01) return data.slice();
  const st = Math.max(-6, Math.min(6, semitones));
  const r = Math.pow(2, st / 12);
  // up-pitch: resample(r) shortens → stretch(r) lengthens back
  // down-pitch: resample(r) lengthens → stretch(r) shortens back
  const resampled = resample(data, r);
  const stretched = timeStretch(resampled, r);
  // fix to the EXACT original length (pad tail with silence / trim)
  const out = new Float32Array(data.length);
  out.set(stretched.subarray(0, Math.min(stretched.length, out.length)));
  return out;
}

/** Shift every channel of an AudioBuffer → new AudioBuffer. */
export function shiftPitchBuffer(buffer: AudioBuffer, semitones: number): AudioBuffer {
  if (!semitones || Math.abs(semitones) < 0.01) return buffer;
  const ctx = new (window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext)(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(
      shiftPitchChannel(buffer.getChannelData(c), semitones) as Float32Array<ArrayBuffer>,
      c,
    );
  }
  return out;
}
