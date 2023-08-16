export default `
const quantumSize = 128;

class PcmWorker extends AudioWorkletProcessor {
  constructor() {
    super();

    this.quantaPerFrame = 12;
    this.quantaCount = 0;
    this.frame = new Int16Array(quantumSize * this.quantaPerFrame);
  }

  process(inputs) {
    if (!inputs[0][0]) {
      return false;
    }
    const offset = quantumSize * this.quantaCount;
    inputs[0][0].forEach((sample, idx) => {
      this.frame[offset + idx] = Math.floor(sample * 0x7fff);
    });
    this.quantaCount += 1;
    if (this.quantaCount === this.quantaPerFrame) {
      this.port.postMessage(this.frame);
      this.quantaCount = 0;
    }
    return true;
  }
}

registerProcessor("pcm-worker", PcmWorker);
`;
