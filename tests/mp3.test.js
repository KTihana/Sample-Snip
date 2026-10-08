import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { encodeWav } from "../extension/audio/wav.js";

for (const rate of [44100, 48000]) {
  test(`real MP3 worker encodes complete stereo 320 kbps frames at ${rate} Hz`, () => {
    const pcm = new Float32Array(rate * 2);
    for (let i = 0; i < rate; i++) {
      pcm[i * 2] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / rate);
      pcm[i * 2 + 1] = 0.2 * Math.sin((2 * Math.PI * 660 * i) / rate);
    }
    let result;
    const scope = {
      self: {
        postMessage: (data) => {
          result = data;
        },
      },
    };
    const ctx = vm.createContext(scope);
    scope.importScripts = (file) =>
      vm.runInContext(
        fs.readFileSync(new URL(`../extension/audio/${file}`, import.meta.url), "utf8"),
        ctx,
      );
    vm.runInContext(
      fs.readFileSync(new URL("../extension/audio/mp3-worker.js", import.meta.url), "utf8"),
      ctx,
    );
    scope.self.onmessage({ data: encodeWav([pcm], rate) });
    assert.equal(result.error, undefined);
    const bytes = Buffer.concat(result.chunks.map((chunk) => Buffer.from(chunk)));
    let offset = 0,
      count = 0;
    while (offset < bytes.length) {
      const h = bytes.readUInt32BE(offset);
      assert.equal(h >>> 21, 0x7ff, "MP3 sync");
      assert.equal((h >>> 19) & 3, 3, "MPEG1");
      assert.equal((h >>> 17) & 3, 1, "Layer III");
      assert.equal((h >>> 12) & 15, 14, "320 kbps");
      assert.equal([44100, 48000, 32000][(h >>> 10) & 3], rate);
      assert.notEqual((h >>> 6) & 3, 3, "two channels");
      offset += Math.floor((144 * 320000) / rate) + ((h >>> 9) & 1);
      count++;
    }
    assert.equal(offset, bytes.length, "all frames complete");
    assert.ok(count * 1152 >= rate);
    assert.ok(count * 1152 - rate <= 2304, "only encoder delay/padding added");
  });
}
