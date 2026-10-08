import { createClip, addMp3, releaseClip } from "../audio/sample.js";
import { MAX_DURATION, METER_BARS, isBusy } from "../shared/constants.js";

let status = "idle";
let error = "";
let started = 0;
let stream;
let context;
let processor;
let chunks = [];
let frames = 0;
let clip;
let finishing;
let levels = [];

export function snapshot() {
  return {
    status,
    error,
    clip,
    levels,
    elapsed: status === "recording" ? Math.min(MAX_DURATION, (Date.now() - started) / 1000) : 0,
  };
}

function setStatus(next) {
  status = next;
  chrome.runtime
    .sendMessage({ target: "background", type: "state-change", status })
    .catch(() => {});
}

function discardClip() {
  releaseClip(clip);
  clip = undefined;
}

export function prepare() {
  error = "";
  setStatus("picking");
}

export function captureError(message) {
  error = message;
  setStatus("error");
}

async function release() {
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
  const capturedContext = context;
  stream = undefined;
  context = undefined;
  processor = undefined;
  if (capturedContext && capturedContext.state !== "closed") await capturedContext.close();
}

async function finalize() {
  if (finishing) return finishing;
  setStatus("stopping");
  finishing = (async () => {
    let next = "ready";
    try {
      if (!frames) throw new Error("No audio was captured. Play audio in the tab and try again.");
      const sample = createClip(chunks, context.sampleRate);
      chunks = [];
      discardClip();
      clip = sample.clip;
      await release();
      await addMp3(clip, sample.wav);
    } catch (cause) {
      error = cause.message;
      next = "error";
    } finally {
      chunks = [];
      try {
        await release();
      } finally {
        setStatus(next);
      }
    }
  })();
  return finishing;
}

export async function start(streamId) {
  if (["starting", "recording", "stopping"].includes(status)) return snapshot();
  error = "";
  finishing = undefined;
  chunks = [];
  frames = 0;
  levels = [];
  setStatus("starting");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
        optional: [
          { echoCancellation: false },
          { noiseSuppression: false },
          { autoGainControl: false },
        ],
      },
      video: false,
    });
    if (!stream.getAudioTracks().length)
      throw new Error("This tab did not provide an audio stream.");
    context = new AudioContext();
    await context.audioWorklet.addModule("../audio/capture-worklet.js");
    const source = context.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(context, "sample-capture", {
      channelCount: 2,
      channelCountMode: "explicit",
    });
    processor.port.onmessage = ({ data }) => {
      if (data.type === "chunk") {
        chunks.push(data.chunk);
        let sum = 0;
        for (const sample of data.chunk) sum += sample * sample;
        levels.push(Math.min(1, Math.sqrt(sum / data.chunk.length) * 5));
        if (levels.length > METER_BARS) levels.shift();
      }
      if (data.type === "finished") {
        frames = data.frames;
        void finalize();
      }
    };
    // Chrome suppresses tab playback during capture; restore it directly.
    source.connect(context.destination);
    source.connect(processor);
    processor.connect(context.destination);
    await context.resume();
    stream.getTracks().forEach((track) => {
      track.onended = stop;
    });
    discardClip();
    started = Date.now();
    setStatus("recording");
  } catch (cause) {
    error = cause.message;
    try {
      await release();
    } finally {
      setStatus("error");
    }
  }
  return snapshot();
}

export function stop() {
  if (status === "recording") {
    setStatus("stopping");
    processor.port.postMessage("stop");
  }
  return snapshot();
}

export function clear() {
  if (isBusy(status)) return snapshot();
  discardClip();
  error = "";
  levels = [];
  setStatus("idle");
  return snapshot();
}

export function installRecorder() {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.target !== "recorder") return;
    const commands = {
      prepare,
      start: () => start(message.streamId),
      stop,
      clear,
      status: snapshot,
      "capture-error": () => captureError(message.error),
    };
    if (!Object.hasOwn(commands, message.type)) return;
    Promise.resolve()
      .then(commands[message.type])
      .then(() => reply(snapshot()))
      .catch((cause) => reply({ error: cause.message }));
    return true;
  });
}
