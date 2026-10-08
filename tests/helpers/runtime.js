import fs from "node:fs";
import vm from "node:vm";
import { encodeWav } from "../../extension/audio/wav.js";
import { releaseClip } from "../../extension/audio/sample.js";
import {
  MAX_DURATION,
  METER_BARS,
  isBusy,
  isPopupSender,
} from "../../extension/shared/constants.js";

export const tick = () => new Promise((resolve) => setImmediate(resolve));

export function runModule(file, scope, exports = "") {
  const source = fs
    .readFileSync(new URL(`../../extension/${file}`, import.meta.url), "utf8")
    .replace(/^import\s[\s\S]*?;\s*/gm, "")
    .replaceAll("export ", "");
  vm.runInNewContext(source + exports, scope);
}

export const audioHelpers = {
  MAX_DURATION,
  METER_BARS,
  isBusy,
  isPopupSender,
  releaseClip,
  createClip(chunks, sampleRate) {
    const wav = encodeWav(chunks, sampleRate);
    return {
      wav,
      clip: {
        url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })),
        filename: "sample.wav",
        duration: (wav.byteLength - 44) / 4 / sampleRate,
        sampleRate,
      },
    };
  },
  async addMp3(clip) {
    clip.mp3Url = URL.createObjectURL(new Blob(["test"], { type: "audio/mpeg" }));
  },
};
