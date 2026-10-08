// PCM input is interleaved, with samples normalized to [-1, 1].
export function encodeWav(chunks, sampleRate, channels = 2) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > 192000)
    throw new Error("Invalid sample rate.");
  if (!Number.isInteger(channels) || channels < 1 || channels > 32)
    throw new Error("Invalid channel count.");
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!Number.isSafeInteger(count) || count > (0xffffffff - 36) / 2)
    throw new Error("Audio is too large for WAV.");
  if (count % channels) throw new Error("Incomplete audio frame.");
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const raw of chunk) {
      const sample = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
      view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  }
  return buffer;
}
