/* eslint-disable max-classes-per-file */
import EventEmitter from "eventemitter3";

import pcmProcessor from "./MicrophoneRecorderWorklet";

type MicrophoneRecorderEvents = {
  start: void;
  end: void;
  data: Int16Array;
};

class MicrophoneRecorder extends EventEmitter<MicrophoneRecorderEvents> {
  private static hasRegisteredProcessor = false;

  private audioContext: AudioContext;

  private source?: MediaStreamAudioSourceNode;

  private sampleRate = 16000;

  constructor(opts?: { sampleRate?: number }) {
    super();
    this.audioContext = new AudioContext({
      sampleRate: this.sampleRate,
      latencyHint: "interactive",
    });
    if (opts && opts.sampleRate) {
      this.sampleRate = opts.sampleRate;
    }
  }

  async start() {
    if (!MicrophoneRecorder.hasRegisteredProcessor) {
      const blob = new Blob([pcmProcessor], { type: "text/javascript" });
      const blobURL = window.URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(blobURL);

      MicrophoneRecorder.hasRegisteredProcessor = true;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: "default",
        sampleRate: this.sampleRate,
        sampleSize: 16,
        channelCount: 1,
      },
      video: false,
    });

    if (this.audioContext.state !== "running") {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(stream);
    const pcmWorker = new AudioWorkletNode(this.audioContext, "pcm-worker", {
      outputChannelCount: [1],
    });
    this.source.connect(pcmWorker);
    pcmWorker.port.onmessage = (event) => {
      const data = event.data as Int16Array;
      this.emit("data", data.buffer);
    };
    pcmWorker.port.start();

    this.emit("start");
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.emit("end");
    }
  }
}

export default MicrophoneRecorder;
