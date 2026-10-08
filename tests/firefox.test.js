import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { audioHelpers, runModule, tick } from "./helpers/runtime.js";

const runner = fs.readFileSync(
  new URL("../extension/firefox/page-recorder.js", import.meta.url),
  "utf8",
);

function pageFixture() {
  const posts = [],
    listeners = new Set();
  const player = {
    paused: false,
    ended: false,
    muted: false,
    volume: 1,
    currentTime: 4,
    seekable: { length: 1 },
  };
  let processor,
    context,
    sourceCount = 0;
  class Context {
    constructor() {
      context = this;
      this.sampleRate = 8000;
      this.state = "running";
      this.destination = {};
    }
    createScriptProcessor(size, inputs, outputs) {
      assert.equal(size, 2048);
      assert.equal(inputs, 2);
      assert.equal(outputs, 2);
      processor = { connect() {}, disconnect() {} };
      return processor;
    }
    createMediaElementSource() {
      sourceCount++;
      return { connect() {}, disconnect() {} };
    }
    async resume() {}
  }
  const window = {
    AudioContext: Context,
    postMessage: (message) => posts.push(message),
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  const scope = { window, document: { currentScript: {}, querySelectorAll: () => [player] } };
  vm.createContext(scope);
  return {
    async start(id) {
      scope.document.currentScript = { dataset: { token: "test-token", session: String(id) } };
      vm.runInContext(runner, scope);
      await tick();
      return posts.at(-1);
    },
    stop() {
      for (const fn of listeners)
        fn({ source: window, data: { sampleSnipToken: "test-token", command: "stop" } });
    },
    posts,
    player,
    listeners,
    get processor() {
      return processor;
    },
    get context() {
      return context;
    },
    get sourceCount() {
      return sourceCount;
    },
  };
}

test("Firefox captures stereo, reuses the player graph and keeps playback connected after Stop", async () => {
  const f = pageFixture();
  const left = new Float32Array([0.1, 0.2]),
    right = new Float32Array([-0.1, -0.2]);
  for (const id of [7, 8]) {
    assert.equal((await f.start(id)).ok, true);
    f.processor.onaudioprocess({
      inputBuffer: { numberOfChannels: 2, getChannelData: (i) => (i ? right : left) },
    });
    assert.deepEqual(Array.from(f.posts.at(-1).chunk), [left[0], right[0], left[1], right[1]]);
    assert.equal(f.posts.at(-1).sessionId, id);
    f.stop();
    assert.equal(f.posts.at(-1).type, "finished");
    assert.equal(f.posts.at(-1).frames, 2);
    assert.equal(f.processor.onaudioprocess, null);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.context.state, "running");
    assert.equal(f.player.paused, false);
  }
  assert.equal(f.sourceCount, 1, "MediaElementSource can be created only once per player");
});

test("Firefox rejects paused media and caps PCM at exactly 60 seconds", async () => {
  const f = pageFixture();
  f.player.paused = true;
  assert.match((await f.start(1)).error, /Start an audio/);
  f.player.paused = false;
  await f.start(2);
  const values = new Float32Array(2048).fill(0.1);
  const process = f.processor.onaudioprocess;
  for (let i = 0; i < 235; i++)
    process({ inputBuffer: { numberOfChannels: 1, getChannelData: () => values } });
  const chunks = f.posts.filter((item) => item.type === "chunk");
  assert.equal(
    chunks.reduce((sum, item) => sum + item.chunk.length / 2, 0),
    480000,
  );
  assert.equal(f.posts.at(-1).frames, 480000);
  assert.equal(f.processor.onaudioprocess, null);
});

function backgroundFixture({ blocked = false } = {}) {
  let onConnect, onMessage, portListener, sourcePort;
  const api = {
    runtime: {
      id: "test",
      getURL: (path) => "moz-extension://test/" + path,
      onConnect: {
        addListener: (fn) => {
          onConnect = fn;
        },
      },
      onMessage: {
        addListener: (fn) => {
          onMessage = fn;
        },
      },
    },
    browserAction: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: {
      query: async () => [{ id: 4 }],
      executeScript: async (_id, options) => {
        assert.equal(options.file, "/firefox/content.js");
        if (blocked) throw new Error("Permission denied");
      },
      sendMessage: async (_id, message) => {
        if (message.type === "prepare") {
          sourcePort = {
            name: "sample-snip-pcm",
            sender: { id: "test", tab: { id: 4 }, frameId: 0 },
            disconnect() {
              this.disconnected = true;
            },
            onMessage: {
              addListener: (fn) => {
                portListener = fn;
              },
            },
            onDisconnect: { addListener() {} },
          };
          onConnect(sourcePort);
          portListener({ type: "begin", sessionId: message.sessionId, sampleRate: 48000 });
        }
        if (message.type === "stop") portListener({ type: "finished", sessionId: 1 });
        return { ok: true };
      },
    },
  };
  runModule("firefox/background.js", {
    ...audioHelpers,
    crypto: { randomUUID },
    browser: api,
    Float32Array,
  });
  return {
    connect: (port) => onConnect(port),
    post: (message) => portListener(message),
    send: (type, sender = { id: "test", url: "moz-extension://test/ui/popup.html" }) =>
      onMessage({ target: "background", type }, sender),
  };
}

test("Firefox authenticates messages, exports both formats, bounds samples and revokes Discard", async () => {
  const f = backgroundFixture();
  const idlePort = {
    name: "sample-snip-pcm",
    disconnect() {
      this.disconnected = true;
    },
  };
  f.connect(idlePort);
  assert.ok(idlePort.disconnected);
  assert.equal(await f.send("start", { id: "untrusted" }), undefined);
  assert.equal((await f.send("start")).status, "recording");
  const wrong = {
    name: "sample-snip-pcm",
    sender: { id: "test", tab: { id: 9 }, frameId: 0 },
    disconnect() {
      this.disconnected = true;
    },
  };
  f.connect(wrong);
  assert.ok(wrong.disconnected);
  f.post({ type: "chunk", sessionId: 99, chunk: [1, 1] });
  f.post({ type: "chunk", sessionId: 1, chunk: [2, -2, 0.1, -0.1] });
  f.post({ type: "chunk", sessionId: 1, chunk: new Array(4098).fill(1) });
  await f.send("stop");
  await tick();
  const state = await f.send("status");
  assert.equal(state.status, "ready");
  assert.equal(state.clip.duration, 2 / 48000);
  assert.ok(state.clip.mp3Url);
  const wav = new DataView(await (await fetch(state.clip.url)).arrayBuffer());
  assert.equal(wav.getUint32(40, true), 8);
  assert.equal(wav.getInt16(44, true), 32767);
  assert.equal((await f.send("clear")).status, "idle");
  assert.equal((await f.send("status")).clip, undefined);
  await assert.rejects(fetch(state.clip.url));
});

test("blocked Firefox access reports a useful error without a recording or connected port", async () => {
  const f = backgroundFixture({ blocked: true });
  const state = await f.send("start");
  assert.equal(state.status, "error");
  assert.match(state.error, /Accessing the selected page: Permission denied/);
  assert.equal(state.clip, undefined);
});

test("Firefox page script can be inserted repeatedly and ignores a cancelled late load", async () => {
  const posts = [];
  const scope = {
    document: {
      currentScript: { dataset: { token: "token", session: "1" } },
      querySelectorAll: () => [],
    },
    window: { postMessage: (value) => posts.push(value) },
  };
  vm.createContext(scope);
  vm.runInContext(runner, scope);
  vm.runInContext(runner, scope);
  await tick();
  assert.equal(posts.length, 2);
  assert.ok(posts.every((value) => value.type === "started" && value.error));
  scope.document.currentScript.dataset.cancelled = "true";
  vm.runInContext(runner, scope);
  await tick();
  assert.equal(posts.length, 2);
});
