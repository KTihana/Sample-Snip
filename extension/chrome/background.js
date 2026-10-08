import { isBusy, isPopupSender } from "../shared/constants.js";

let creating;
let starting = false;
const send = (type, data = {}) => chrome.runtime.sendMessage({ target: "recorder", type, ...data });

async function hasRecorder() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return contexts.length > 0;
}

async function ensureRecorder() {
  if (await hasRecorder()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: "chrome/offscreen.html",
      reasons: ["USER_MEDIA", "BLOBS"],
      justification: "Capture selected-tab audio and encode local samples.",
    })
    .finally(() => {
      creating = undefined;
    });
  await creating;
}

async function start() {
  const state = await send("status");
  if (starting || isBusy(state.status)) return state;
  starting = true;
  try {
    await send("prepare");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Choose a browser tab first.");
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    return await send("start", { streamId });
  } catch (error) {
    return send("capture-error", { error: error.message });
  } finally {
    starting = false;
  }
}

async function handle(message) {
  if (message.type === "state-change") {
    await chrome.action.setBadgeText({ text: isBusy(message.status) ? "REC" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#d94651" });
    return { ok: true };
  }
  if (message.type === "status" && !(await hasRecorder())) return { status: "idle", elapsed: 0 };
  await ensureRecorder();
  return message.type === "start" ? start() : send(message.type);
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== "background" || sender.id !== chrome.runtime.id) return;
  if (message.type === "state-change") {
    if (sender.url !== chrome.runtime.getURL("chrome/offscreen.html")) return;
  } else if (
    !isPopupSender(sender, chrome.runtime) ||
    !["status", "start", "stop", "clear"].includes(message.type)
  )
    return;
  handle(message)
    .then(reply)
    .catch((error) => reply({ error: error.message }));
  return true;
});
