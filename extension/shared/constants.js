export const MAX_DURATION = 60;
export const METER_BARS = 38;

export const isBusy = (status) => ["picking", "starting", "recording", "stopping"].includes(status);

export function isPopupSender(sender, runtime) {
  return (
    sender.id === runtime.id && sender.url?.split(/[?#]/)[0] === runtime.getURL("ui/popup.html")
  );
}
