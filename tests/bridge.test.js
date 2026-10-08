import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function fixture() {
  const listeners = new Set(),
    sent = [],
    scripts = [];
  let handle, timeout, disconnect;
  const port = {
    postMessage: (value) => sent.push(value),
    disconnect() {
      disconnect();
    },
    onDisconnect: {
      addListener: (fn) => {
        disconnect = fn;
      },
    },
  };
  const window = {
    postMessage() {},
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  const scope = {
    window,
    document: {
      createElement: () => ({
        dataset: {},
        remove() {
          this.removed = true;
        },
      }),
      head: { appendChild: (script) => scripts.push(script) },
    },
    browser: {
      runtime: {
        id: "test",
        getURL: (name) => `moz-extension://test/${name}`,
        connect: () => port,
        onMessage: {
          addListener: (fn) => {
            handle = fn;
          },
        },
      },
    },
    setTimeout: (fn) => {
      timeout = fn;
      return 1;
    },
    clearTimeout() {},
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../extension/firefox/content.js", import.meta.url), "utf8"),
    scope,
  );
  return {
    send: (type, sender = { id: "test" }) =>
      handle({ target: "page-recorder", type, token: "token", sessionId: 1 }, sender),
    event: (data, source = window) => {
      for (const fn of listeners)
        fn({ source, data: { sampleSnipToken: "token", sessionId: 1, ...data } });
    },
    timeout: () => timeout(),
    sent,
    scripts,
    listeners,
  };
}

test("Firefox bridge validates token, session, origin and bounded PCM before forwarding", async () => {
  const f = fixture();
  assert.equal(f.send("prepare", { id: "other-extension" }), undefined);
  const started = f.send("prepare");
  f.event({ type: "begin", sampleRate: 48000 }, {});
  f.event({ type: "begin", sampleSnipToken: "wrong", sampleRate: 48000 });
  f.event({ type: "begin", sessionId: 2, sampleRate: 48000 });
  assert.equal(f.sent.length, 0);
  f.event({ type: "begin", sampleRate: 48000 });
  f.event({ type: "started", ok: true });
  assert.equal((await started).ok, true);
  for (const chunk of [[NaN, 0], [1], new Array(4098).fill(0)]) f.event({ type: "chunk", chunk });
  f.event({ type: "chunk", chunk: [0.2, -0.2] });
  assert.equal(f.sent.length, 2);
  f.event({ type: "finished" });
  assert.equal(f.sent.at(-1).type, "finished");
  assert.equal(f.listeners.size, 0);
  assert.equal(f.scripts[0].dataset.cancelled, "true");
});

for (const failure of ["script blocked", "timeout", "cancel"]) {
  test(`Firefox bridge cleans up ${failure} and allows retry`, async () => {
    const f = fixture();
    const started = f.send("prepare");
    if (failure === "script blocked") f.scripts[0].onerror();
    if (failure === "timeout") f.timeout();
    if (failure === "cancel") f.send("cancel");
    assert.ok((await started).error);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.scripts[0].removed, true);
    const retry = f.send("prepare");
    f.event({ type: "started", ok: true });
    assert.equal((await retry).ok, true);
    f.send("cancel");
    assert.equal(f.listeners.size, 0);
  });
}
