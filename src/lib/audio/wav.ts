// ============================================================
// ঠাট্টা স্টুডিও — Phase 4 (সাউন্ড স্টুডিও): minimal WAV encoder
//
// AudioBuffer → 16-bit PCM WAV Blob. Used everywhere procedural
// audio leaves the WebAudio world (timeline previews, MP4 export
// mixdown, mic-recorded clips, IndexedDB persistence).
// ============================================================

/** Encode an AudioBuffer (mono or stereo) as a PCM16 WAV Blob. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels);
  const len = buffer.length;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const headerSize = 44;

  const ab = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(ab);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));

  let off = headerSize;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = chans[c][i];
      v = v > 1 ? 1 : v < -1 ? -1 : v;
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

/** Waveform peaks (0..1, ~24 per second) from an AudioBuffer's channel 0. */
export function bufferPeaks(buffer: AudioBuffer, fps = 24): number[] {
  const data = buffer.getChannelData(0);
  const frameLen = Math.max(1, Math.floor(buffer.sampleRate / fps));
  const frames = Math.max(1, Math.floor(data.length / frameLen));
  const peaks = new Array<number>(frames);
  let max = 0.0001;
  for (let f = 0; f < frames; f++) {
    let peak = 0;
    const off = f * frameLen;
    for (let i = 0; i < frameLen; i++) {
      const v = Math.abs(data[off + i] ?? 0);
      if (v > peak) peak = v;
    }
    peaks[f] = peak;
    if (peak > max) max = peak;
  }
  const scale = 1 / max;
  for (let f = 0; f < frames; f++) peaks[f] = Math.min(1, peaks[f] * scale);
  return peaks;
}

/** Shared lazily-created AudioContext for decoding + metering. */
let sharedCtx: AudioContext | null = null;
export function sharedAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedCtx = new AC();
  }
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}
