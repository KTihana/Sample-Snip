export function encodeMp3(wav) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./mp3-worker.js", import.meta.url));
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("MP3 conversion took too long. Your WAV is still available."));
    }, 120000);
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(new Blob(data.chunks, { type: "audio/mpeg" }));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("MP3 conversion failed. Your WAV is still available."));
    };
    try {
      worker.postMessage(wav, [wav]);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
