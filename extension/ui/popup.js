import { METER_BARS, isBusy } from "../shared/constants.js";
import { formatTimer, formatTime } from "./time.js";

const $ = (id) => document.getElementById(id);
let busy = false;
let refreshing = false;
let revision = 0;
let currentUrl;
let uiError = "";
const extension = globalThis.browser || globalThis.chrome;
const send = (type) => extension.runtime.sendMessage({ target: "background", type });
$("browser-note").hidden = !extension.sidebarAction;
const panel = new URLSearchParams(location.search).has("panel");
if (panel) {
  document.body.classList.add("pinned-panel");
  $("pin").setAttribute("aria-pressed", "true");
  $("pin").setAttribute("aria-label", "Recorder pinned to side panel");
  $("pin").title = "Recorder pinned. Use the browser’s close button to close this panel.";
  $("pin").disabled = true;
}
$("pin").addEventListener("click", async () => {
  try {
    if (extension.sidebarAction) await extension.sidebarAction.open();
    else {
      const current = await extension.windows.getCurrent();
      await extension.sidePanel.open({ windowId: current.id });
    }
    window.close();
  } catch (error) {
    uiError = `Could not open the side panel: ${error.message}`;
    $("error").textContent = uiError;
    $("error").hidden = false;
  }
});
const bars = Array.from({ length: METER_BARS }, () => {
  const bar = document.createElement("span");
  $("meter").appendChild(bar);
  return bar;
});
function render(state) {
  if (state.error || uiError) {
    $("error").textContent = state.error || uiError;
    $("error").hidden = false;
  } else $("error").hidden = true;
  if (!state.status) return;
  document.body.dataset.state = state.status;
  const active = isBusy(state.status);
  $("record").disabled = active || busy;
  $("stop").disabled = state.status !== "recording" || busy;
  $("stop-label").textContent = state.status === "recording" ? "Stop recording" : "Stop";
  $("clear").disabled = active || busy;
  bars.forEach((bar, index) => {
    bar.style.height = `${2 + (state.levels?.[index] || 0) * 30}px`;
  });
  $("dot").classList.toggle("live", active);
  $("status").textContent = {
    idle: "Ready to record",
    picking: "Preparing tab audio…",
    starting: "Starting capture…",
    recording: "Recording",
    stopping: "Preparing your sample…",
    ready: "Sample ready",
    error: "Capture needs attention",
  }[state.status];
  $("record-help").textContent =
    state.status === "recording"
      ? panel
        ? "Keep listening. We’re saving this tab’s audio.\nUse the player while this panel stays open."
        : "Keep listening. We’re saving this tab’s audio.\nYou can close this popup and reopen to stop."
      : "Play audio in your tab, then press Record.\nPreview and download your sample here.";
  const seconds = state.status === "recording" ? state.elapsed : (state.clip?.duration ?? 0);
  $("timer").textContent = formatTimer(seconds);
  $("clip").hidden = !state.clip;
  if (state.clip && currentUrl !== state.clip.url) {
    currentUrl = state.clip.url;
    $("preview").src = currentUrl;
    $("download").href = currentUrl;
    $("download").download = state.clip.filename;
    $("details").textContent = `${state.clip.duration.toFixed(1)}s · stereo`;
  } else if (!state.clip && currentUrl) {
    $("preview").pause();
    $("preview").removeAttribute("src");
    $("preview").load();
    $("download").removeAttribute("href");
    $("download").removeAttribute("download");
    currentUrl = undefined;
  }
  const mp3 = $("download-mp3");
  if (state.clip?.mp3Url) {
    mp3.href = state.clip.mp3Url;
    mp3.download = state.clip.filename.replace(/\.wav$/, ".mp3");
    mp3.textContent = "Download MP3";
    mp3.setAttribute("aria-disabled", "false");
  } else {
    mp3.removeAttribute("href");
    mp3.removeAttribute("download");
    mp3.textContent = state.clip?.mp3Error ? "MP3 unavailable" : "Preparing MP3…";
    mp3.setAttribute("aria-disabled", "true");
  }
  $("mp3-error").hidden = !state.clip?.mp3Error;
  $("mp3-error").textContent = state.clip?.mp3Error || "";
}
async function command(type) {
  busy = true;
  revision++;
  uiError = "";
  $("record").disabled = true;
  $("stop").disabled = true;
  $("preview").pause();
  try {
    render(await send(type));
  } catch (error) {
    render({ error: error.message });
  } finally {
    busy = false;
    await refresh();
  }
}
async function refresh() {
  if (busy || refreshing) return;
  refreshing = true;
  const requestedRevision = revision;
  try {
    const state = await send("status");
    if (!busy && revision === requestedRevision) render(state);
  } catch (error) {
    if (revision === requestedRevision) render({ error: error.message });
  } finally {
    refreshing = false;
  }
}
$("record").addEventListener("click", () => command("start"));
$("stop").addEventListener("click", () => command("stop"));
$("clear").addEventListener("click", () => command("clear"));
const preview = $("preview");
$("play").addEventListener("click", async () => {
  if (!preview.paused) return preview.pause();
  try {
    await preview.play();
  } catch {
    uiError = "Preview could not play. Download your sample to listen.";
    $("error").textContent = uiError;
    $("error").hidden = false;
  }
});
for (const event of ["play", "pause", "ended"])
  preview.addEventListener(event, () => {
    $("play").setAttribute("aria-label", preview.paused ? "Play sample" : "Pause sample");
    $("play").firstElementChild.textContent = preview.paused ? "▶" : "Ⅱ";
  });
for (const event of ["timeupdate", "loadedmetadata", "emptied"])
  preview.addEventListener(event, () => {
    const duration = Number.isFinite(preview.duration) ? preview.duration : 0;
    $("seek").max = duration || 1;
    $("seek").value = preview.currentTime || 0;
    $("seek").disabled = !duration;
    $("play-time").textContent = `${formatTime(preview.currentTime)} / ${formatTime(duration)}`;
  });
$("seek").addEventListener("input", () => {
  if (Number.isFinite(preview.duration)) preview.currentTime = Number($("seek").value);
});
await refresh();
setInterval(() => {
  if (!document.hidden) void refresh();
}, 300);
