import { encodeWav } from "./wav.js";
import { encodeMp3 } from "./mp3.js";

export function createClip(chunks, sampleRate) {
  const wav = encodeWav(chunks, sampleRate);
  const frames = (wav.byteLength - 44) / 4;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    wav,
    clip: {
      url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })),
      filename: `simple-snip-${timestamp}.wav`,
      duration: frames / sampleRate,
      sampleRate,
    },
  };
}

export async function addMp3(clip, wav) {
  try {
    clip.mp3Url = URL.createObjectURL(await encodeMp3(wav));
  } catch (error) {
    clip.mp3Error = error.message;
  }
}

export function releaseClip(clip) {
  if (!clip) return;
  URL.revokeObjectURL(clip.url);
  if (clip.mp3Url) URL.revokeObjectURL(clip.mp3Url);
}
