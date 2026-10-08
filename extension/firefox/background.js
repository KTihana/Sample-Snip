import { createClip, addMp3, releaseClip } from "../audio/sample.js";
import { MAX_DURATION, METER_BARS, isBusy, isPopupSender } from "../shared/constants.js";

let status = "idle";
let error = "";
let clip;
let active;
let levels = [];
let sequence = 0;

function snapshot() {
  return {
    status,
    error,
    clip,
    levels,
    elapsed:
      status === "recording" && active
        ? Math.min(MAX_DURATION, (Date.now() - active.started) / 1000)
        : 0,
  };
}

function update(next) {
  status = next;
  void browser.browserAction.setBadgeText({ text: isBusy(status) ? "REC" : "" });
  void browser.browserAction.setBadgeBackgroundColor({ color: "#d94651" });
}

function discard() {
  releaseClip(clip);
  clip = undefined;
}

async function finish(session) {
  if (session.finishing) return session.finishing;
  session.finishing = (async () => {
    update("stopping");
    try {
      if (!session.frames || !session.sampleRate)
        throw new Error("No audio was captured from this player.");
      if (!session.audible)
        throw new Error(
          "This player provided only silence. Cross-origin or protected media may be blocked. Try another player.",
        );
      const sample = createClip(session.chunks, session.sampleRate);
      session.chunks = [];
      discard();
      clip = sample.clip;
      await addMp3(clip, sample.wav);
      update("ready");
    } catch (cause) {
      error = cause.message;
      update("error");
    } finally {
      session.chunks = [];
      if (active === session) active = undefined;
    }
  })();
  return session.finishing;
}

function acceptChunk(session, samples) {
  if (!session.sampleRate || !Array.isArray(samples) || samples.length > 4096 || samples.length % 2)
    return;
  const room = Math.max(0, session.sampleRate * MAX_DURATION - session.frames) * 2;
  const chunk = Float32Array.from(samples.slice(0, room), (value) =>
    Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0,
  );
  if (!chunk.length) return;
  session.chunks.push(chunk);
  session.frames += chunk.length / 2;
  let sum = 0;
  for (const value of chunk) sum += value * value;
  session.audible ||= sum > 1e-8;
  levels.push(Math.min(1, Math.sqrt(sum / chunk.length) * 5));
  if (levels.length > METER_BARS) levels.shift();
}

browser.runtime.onConnect.addListener((port) => {
  if (
    !active ||
    port.name !== "sample-snip-pcm" ||
    port.sender?.id !== browser.runtime.id ||
    port.sender.tab?.id !== active.tabId ||
    port.sender.frameId !== 0
  )
    return port.disconnect();
  const session = active;
  port.onMessage.addListener((message) => {
    if (message?.sessionId !== session.id || active !== session || session.finishing) return;
    if (
      message.type === "begin" &&
      !session.sampleRate &&
      Number.isInteger(message.sampleRate) &&
      message.sampleRate >= 8000 &&
      message.sampleRate <= 192000
    ) {
      session.sampleRate = message.sampleRate;
      session.started = Date.now();
      discard();
      update("recording");
    }
    if (message.type === "chunk") acceptChunk(session, message.chunk);
    if (message.type === "finished") void finish(session);
  });
  port.onDisconnect.addListener(() => {
    if (active === session && session.sampleRate && !session.finishing) void finish(session);
  });
});

async function start() {
  error = "";
  levels = [];
  update("starting");
  let phase = "Selecting the page";
  let session;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Choose a webpage with an audio/video player first.");
    session = { id: ++sequence, tabId: tab.id, chunks: [], frames: 0, audible: false };
    active = session;
    phase = "Accessing the selected page";
    await browser.tabs.executeScript(tab.id, { file: "/firefox/content.js" });
    phase = "Capturing the player";
    const response = await browser.tabs.sendMessage(
      tab.id,
      {
        target: "page-recorder",
        type: "prepare",
        sessionId: session.id,
        token: crypto.randomUUID(),
      },
      { frameId: 0 },
    );
    if (!response?.ok) throw new Error(response?.error || "Could not connect the recorder.");
  } catch (cause) {
    if (session && active !== session) return;
    active = undefined;
    if (session)
      await browser.tabs
        .sendMessage(session.tabId, { target: "page-recorder", type: "cancel" })
        .catch(() => {});
    error = `${phase}: ${cause.message || "Capture was blocked."}`;
    update("error");
  }
}

async function stop() {
  update("stopping");
  const session = active;
  try {
    await browser.tabs.sendMessage(
      session.tabId,
      { target: "page-recorder", type: "stop" },
      { frameId: 0 },
    );
  } catch {
    await finish(session);
  }
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (!isPopupSender(sender, browser.runtime) || message?.target !== "background") return;
  if (message.type === "start" && !isBusy(status)) await start();
  if (message.type === "stop" && status === "recording") await stop();
  if (message.type === "clear" && !isBusy(status)) {
    discard();
    error = "";
    levels = [];
    update("idle");
  }
  return snapshot();
});
