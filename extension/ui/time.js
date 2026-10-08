export function formatTimer(seconds) {
  const tenths = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 10));
  const minutes = Math.floor(tenths / 600);
  return `${String(minutes).padStart(2, "0")}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
