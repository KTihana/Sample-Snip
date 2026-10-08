(() => {
  // Runs in the selected page's realm. Player playback stays connected after Stop.
  async function capturePlayers(sessionId, token) {
    const elements = [...document.querySelectorAll("audio, video")].filter(
      (element) => !element.paused && !element.ended && !element.muted && element.volume > 0,
    );
    if (!elements.length)
      return {
        error:
          "Start an audio/video player on this page before recording. Web Audio games and embedded players are not supported.",
      };
    const key = Symbol.for("sample-snip.player-audio-graph");
    // A MediaElementSource may be created only once for each player. Reuse its
    // context and playback route; closing that context would silence the player.
    const graph =
      window[key] || (window[key] = { context: new window.AudioContext(), sources: new WeakMap() });
    const context = graph.context,
      sources = [];
    const send = (data) => window.postMessage({ ...data, sampleSnipToken: token }, "*");
    const connectedSources = [];
    let processor,
      done = false,
      frames = 0,
      phase = "Connecting player audio";
    function onCommand(event) {
      if (
        event.source === window &&
        event.data?.sampleSnipToken === token &&
        event.data.command === "stop"
      )
        finish();
    }
    function release() {
      if (processor) {
        processor.onaudioprocess = null;
        connectedSources.forEach((source) => source.disconnect(processor));
        processor.disconnect();
      }
      window.removeEventListener("message", onCommand);
    }
    function finish() {
      if (done) return;
      done = true;
      release();
      send({ type: "finished", sessionId, frames });
    }
    try {
      window.addEventListener("message", onCommand);
      phase = "Resuming player capture";
      await context.resume();
      if (done) return { error: "Recording was cancelled." };
      if (context.state !== "running")
        throw new Error(
          "Click Play on the webpage before recording so Firefox can start audio capture.",
        );
      phase = "Connecting player audio";
      for (const element of elements) {
        let source = graph.sources.get(element);
        if (!source) {
          source = context.createMediaElementSource(element);
          source.connect(context.destination);
          graph.sources.set(element, source);
          // Firefox can keep already-decoded playback outside the new audio graph.
          // Re-seek to the current position to route that buffered audio immediately.
          const position = element.currentTime;
          if (Number.isFinite(position) && element.seekable?.length) element.currentTime = position;
        }
        sources.push(source);
      }
      phase = "Starting the audio processor";
      processor = context.createScriptProcessor(2048, 2, 2);
      sources.forEach((source) => {
        source.connect(processor);
        connectedSources.push(source);
      });
      processor.connect(context.destination); // Outputs silence; playback uses the direct route.
      send({ type: "begin", sessionId, sampleRate: context.sampleRate });
      processor.onaudioprocess = ({ inputBuffer }) => {
        if (done || !sources.length) return;
        const left = inputBuffer.getChannelData(0);
        const right = inputBuffer.getChannelData(Math.min(1, inputBuffer.numberOfChannels - 1));
        const count = Math.min(left.length, context.sampleRate * 60 - frames);
        const chunk = new Array(count * 2);
        for (let i = 0; i < count; i++) {
          chunk[i * 2] = left[i];
          chunk[i * 2 + 1] = right[i];
        }
        if (count) send({ type: "chunk", sessionId, chunk });
        frames += count;
        if (frames >= context.sampleRate * 60) finish();
      };
      return { ok: true };
    } catch (error) {
      release();
      return { error: `${phase}: ${error.message || error.name || "capture was blocked"}` };
    }
  }

  const script = document.currentScript;
  if (!script || script.dataset.cancelled === "true") return;
  const token = script.dataset.token;
  const sessionId = Number(script.dataset.session);
  void capturePlayers(sessionId, token)
    .catch((error) => ({ error: error.message || "The player recorder could not start." }))
    .then((result) =>
      window.postMessage({ ...result, type: "started", sessionId, sampleSnipToken: token }, "*"),
    );
})();
