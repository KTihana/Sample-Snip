import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { encodeWav } from "../extension/audio/wav.js";

test("WAV has correct stereo header, interleaving, clipping, and silence for invalid samples", () => {
  const wav = encodeWav(
    [new Float32Array([-1, 1, -0.5, 0.5]), new Float32Array([-2, 2, NaN, 0])],
    48000,
  );
  const view = new DataView(wav);
  const text = (start, end) => Buffer.from(wav).subarray(start, end).toString();
  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 12), "WAVE");
  assert.equal(view.getUint32(4, true), wav.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(28, true), 192000);
  assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(text(36, 40), "data");
  assert.equal(view.getUint32(40, true), 16);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true)),
    [-32768, 32767, -16384, 16384, -32768, 32767, 0, 0],
  );
  assert.throws(() => encodeWav([new Float32Array(3)], 48000), /Incomplete/);
});

function worklet(rate = 48000) {
  const messages = [];
  let Capture;
  vm.runInNewContext(
    fs.readFileSync(new URL("../extension/audio/capture-worklet.js", import.meta.url), "utf8"),
    {
      sampleRate: rate,
      AudioWorkletProcessor: class {
        constructor() {
          this.port = { postMessage: (msg) => messages.push(msg) };
        }
      },
      registerProcessor: (_, processor) => {
        Capture = processor;
      },
    },
  );
  return { processor: new Capture(), messages };
}

test("Stop flushes the partial block exactly once and preserves stereo frame order", () => {
  const { processor, messages } = worklet();
  processor.process([[new Float32Array([0.1, 0.2, 0.3]), new Float32Array([0.4, 0.5, 0.6])]]);
  processor.port.onmessage({ data: "stop" });
  processor.port.onmessage({ data: "stop" });
  assert.equal(messages.length, 2);
  assert.deepEqual(
    Array.from(messages[0].chunk),
    Array.from(new Float32Array([0.1, 0.4, 0.2, 0.5, 0.3, 0.6])),
  );
  assert.equal(messages[1].frames, 3);
  assert.equal(processor.process([]), false);
});

test("Automatic stop is capped at exactly 60 seconds and mono is duplicated into stereo", () => {
  const { processor, messages } = worklet(40);
  processor.process([[new Float32Array(2500).fill(0.25)]]);
  const chunks = messages.filter((msg) => msg.type === "chunk").map((msg) => msg.chunk);
  const finished = messages.at(-1);
  assert.equal(finished.frames, 2400);
  assert.equal(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    4800,
  );
  const wav = new DataView(encodeWav(chunks, 40));
  assert.equal(wav.getUint32(40, true) / wav.getUint32(28, true), 60);
  assert.equal(wav.getInt16(44, true), wav.getInt16(46, true));
});
