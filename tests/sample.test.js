import test from "node:test";
import assert from "node:assert/strict";
import { createClip, addMp3, releaseClip } from "../extension/audio/sample.js";
import { encodeWav } from "../extension/audio/wav.js";
import { encodeMp3 } from "../extension/audio/mp3.js";
import { formatTimer, formatTime } from "../extension/ui/time.js";

test("timer rounding carries into the next minute and handles invalid inputs", () => {
  assert.equal(formatTimer(59.96), "01:00.0");
  assert.equal(formatTimer(59.94), "00:59.9");
  assert.equal(formatTimer(NaN), "00:00.0");
  assert.equal(formatTimer(-1), "00:00.0");
  assert.equal(formatTime(61.9), "1:01");
});

test("WAV rejects invalid metadata and incomplete channel frames", () => {
  for (const rate of [0, -1, NaN, Infinity, 192001, 44100.5])
    assert.throws(() => encodeWav([], rate));
  for (const channels of [0, 1.5, 33]) assert.throws(() => encodeWav([], 48000, channels));
  assert.throws(() => encodeWav([new Float32Array(3)], 48000));
});

test("failed worker transfer terminates the worker and WAV remains downloadable", async () => {
  const original = globalThis.Worker;
  let worker;
  globalThis.Worker = class {
    constructor() {
      worker = this;
    }
    postMessage() {
      throw new Error("Transfer failed");
    }
    terminate() {
      this.terminated = true;
    }
  };
  const sample = createClip([new Float32Array([0.2, -0.2])], 48000);
  try {
    await assert.rejects(encodeMp3(sample.wav), /Transfer failed/);
    assert.ok(worker.terminated);
    await addMp3(sample.clip, sample.wav);
    assert.match(sample.clip.mp3Error, /Transfer failed/);
    assert.equal(sample.clip.duration, 1 / 48000);
    assert.match(sample.clip.filename, /^simple-snip-.*\.wav$/);
    assert.equal((await (await fetch(sample.clip.url)).arrayBuffer()).byteLength, 48);
    releaseClip(sample.clip);
    await assert.rejects(fetch(sample.clip.url));
  } finally {
    releaseClip(sample.clip);
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  }
});
