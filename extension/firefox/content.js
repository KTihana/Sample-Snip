(() => {
  if (globalThis.sampleSnipBridge) return;
  globalThis.sampleSnipBridge = true;
  let session;

  function prepare(sessionId, token) {
    if (session) return Promise.resolve({ error: "A recording is already active on this page." });
    const port = browser.runtime.connect({ name: "sample-snip-pcm" });
    const script = document.createElement("script");
    let timeout;
    let resolveStart;
    let settled = false;
    let closed = false;
    const started = new Promise((resolve) => {
      resolveStart = resolve;
    });
    const command = () => window.postMessage({ sampleSnipToken: token, command: "stop" }, "*");

    function settle(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveStart(result);
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      script.dataset.cancelled = "true";
      script.remove();
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (session?.sessionId === sessionId) session = undefined;
      settle({ error: "The player recorder closed before starting." });
    }

    function fail(error) {
      settle({ error });
      command();
      cleanup();
      port.disconnect();
    }

    function receive(event) {
      const data = event.data;
      if (
        closed ||
        event.source !== window ||
        data?.sampleSnipToken !== token ||
        data.sessionId !== sessionId
      )
        return;
      if (data.type === "started") {
        settle(data);
        if (data.error) fail(data.error);
      }
      if (data.type === "begin")
        port.postMessage({ type: "begin", sessionId, sampleRate: data.sampleRate });
      if (
        data.type === "chunk" &&
        Array.isArray(data.chunk) &&
        data.chunk.length <= 4096 &&
        !(data.chunk.length % 2) &&
        data.chunk.every(Number.isFinite)
      ) {
        port.postMessage({ type: "chunk", sessionId, chunk: data.chunk });
      }
      if (data.type === "finished") {
        port.postMessage({ type: "finished", sessionId });
        cleanup();
        port.disconnect();
      }
    }

    window.addEventListener("message", receive);
    port.onDisconnect.addListener(() => {
      command();
      cleanup();
    });
    session = {
      sessionId,
      command,
      cancel: () => {
        command();
        cleanup();
        port.disconnect();
      },
    };
    script.src = browser.runtime.getURL("firefox/page-recorder.js");
    script.dataset.token = token;
    script.dataset.session = sessionId;
    script.onload = () => script.remove();
    script.onerror = () => fail("This page blocked the player recorder. Try another webpage.");
    timeout = setTimeout(() => fail("The page did not start the player recorder."), 5000);
    (document.head || document.documentElement).appendChild(script);
    return started;
  }

  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || message?.target !== "page-recorder") return;
    if (message.type === "prepare") return prepare(message.sessionId, message.token);
    if (message.type === "stop") {
      session?.command();
      return Promise.resolve({ ok: true });
    }
    if (message.type === "cancel") {
      session?.cancel();
      return Promise.resolve({ ok: true });
    }
  });
})();
