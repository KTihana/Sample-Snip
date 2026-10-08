class SampleCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.used = 0;
    this.frames = 0;
    this.done = false;
    this.port.onmessage = (event) => {
      if (event.data === "stop") this.finish();
    };
  }
  flush() {
    if (!this.used) return;
    const chunk = this.buffer.slice(0, this.used);
    this.port.postMessage({ type: "chunk", chunk }, [chunk.buffer]);
    this.used = 0;
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.flush();
    this.port.postMessage({ type: "finished", frames: this.frames });
  }
  process(inputs) {
    if (this.done) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      this.buffer[this.used++] = channels[0][i];
      this.buffer[this.used++] = (channels[1] || channels[0])[i];
      this.frames++;
      if (this.used === this.buffer.length) this.flush();
      if (this.frames >= sampleRate * 60) {
        this.finish();
        return false;
      }
    }
    // Outputs stay silent; playback uses a separate direct connection.
    return true;
  }
}
registerProcessor("sample-capture", SampleCapture);
