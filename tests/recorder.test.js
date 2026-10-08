import test from "node:test";
import assert from "node:assert/strict";
import { audioHelpers, runModule, tick } from "./helpers/runtime.js";

function fixture({ failCapture = false } = {}) {
  const connections = [],
    requested = [],
    tracks = [
      {
        stop() {
          this.stopped = true;
        },
      },
    ];
  const media = { getTracks: () => tracks, getAudioTracks: () => tracks };
  let node, context;
  class FakeContext {
    constructor() {
      context = this;
      this.sampleRate = 48000;
      this.state = "running";
      this.destination = {};
      this.audioWorklet = {
        addModule: async (file) => assert.equal(file, "../audio/capture-worklet.js"),
      };
    }
    createMediaStreamSource() {
      return { connect: (target) => connections.push(target) };
    }
    async resume() {}
    async close() {
      this.state = "closed";
    }
  }
  class FakeNode {
    constructor() {
      node = this;
      this.port = {
        postMessage: (message) => {
          assert.equal(message, "stop");
          this.port.onmessage({ data: { type: "chunk", chunk: new Float32Array([0.2, -0.2]) } });
          this.port.onmessage({ data: { type: "finished", frames: 1 } });
        },
      };
    }
    connect() {}
  }
  const scope = {
    ...audioHelpers,
    Blob,
    URL,
    AudioContext: FakeContext,
    AudioWorkletNode: FakeNode,
    navigator: {
      mediaDevices: {
        getUserMedia: async (constraints) => {
          assert.deepEqual(Object.keys(constraints.audio).sort(), ["mandatory", "optional"]);
          assert.equal(constraints.audio.mandatory.chromeMediaSource, "tab");
          assert.equal(constraints.video, false);
          requested.push(constraints);
          if (failCapture) throw new Error("Tab was closed");
          return media;
        },
      },
    },
    chrome: { runtime: { sendMessage: async () => {} } },
  };
  runModule(
    "chrome/recorder.js",
    scope,
    "\nglobalThis.api = { start, stop, clear, snapshot, prepare, captureError };",
  );
  return {
    api: scope.api,
    tracks,
    connections,
    requested,
    get context() {
      return context;
    },
    get node() {
      return node;
    },
  };
}

test("Chrome restores playback, releases capture, supports another sample and revokes discarded files", async () => {
  const f = fixture();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await f.api.start("test-id")).status, "recording");
    assert.equal(f.connections.includes(f.context.destination), true);
    assert.ok(f.connections.includes(f.node));
    assert.equal(f.api.clear().status, "recording", "Discard must not interrupt a recording");
    f.api.stop();
    f.api.stop();
    await tick();
    const final = f.api.snapshot();
    assert.equal(final.status, "ready");
    assert.equal(final.clip.duration, 1 / 48000);
    assert.ok(final.clip.mp3Url);
    assert.equal(f.context.state, "closed");
    assert.ok(f.tracks.every((track) => track.stopped));
    assert.equal(f.api.clear().status, "idle");
    await assert.rejects(fetch(final.clip.url));
    await assert.rejects(fetch(final.clip.mp3Url));
  }
  assert.equal(f.requested.length, 2);
});

test("failed Chrome capture reports the cause and can be prepared for another attempt", async () => {
  const f = fixture({ failCapture: true });
  assert.equal((await f.api.start("test-id")).status, "error");
  assert.match(f.api.snapshot().error, /Tab was closed/);
  f.api.prepare();
  assert.equal(f.api.snapshot().status, "picking");
  f.api.captureError("Cancelled");
  assert.equal(f.api.snapshot().status, "error");
  f.api.prepare();
  assert.equal(f.api.snapshot().error, "");
});
