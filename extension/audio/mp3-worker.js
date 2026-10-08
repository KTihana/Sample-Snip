importScripts("../vendor/lame.min.js");
self.onmessage = ({ data }) => {
  try {
    const view = new DataView(data);
    const channels = view.getUint16(22, true);
    const rate = view.getUint32(24, true);
    if (channels !== 2 || view.getUint16(34, true) !== 16)
      throw new Error("MP3 conversion requires stereo 16-bit PCM.");
    const frames = view.getUint32(40, true) / 4;
    const encoder = new lamejs.Mp3Encoder(2, rate, 320);
    const chunks = [];
    const left = new Int16Array(1152);
    const right = new Int16Array(1152);
    for (let start = 0; start < frames; start += 1152) {
      const count = Math.min(1152, frames - start);
      for (let i = 0; i < count; i++) {
        left[i] = view.getInt16(44 + (start + i) * 4, true);
        right[i] = view.getInt16(46 + (start + i) * 4, true);
      }
      const output = encoder.encodeBuffer(left.subarray(0, count), right.subarray(0, count));
      if (output.length) chunks.push(new Uint8Array(output));
    }
    const tail = encoder.flush();
    if (tail.length) chunks.push(new Uint8Array(tail));
    self.postMessage(
      { chunks },
      chunks.map((chunk) => chunk.buffer),
    );
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
