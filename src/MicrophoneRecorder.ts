/* eslint-disable max-classes-per-file */
import { EventEmitter } from "eventemitter3";

import pcmProcessor from "./MicrophoneRecorderWorklet.js";

type MicrophoneRecorderEvents = {
  start: void;
  end: void;
  data: Int16Array;
};

class MicrophoneRecorder extends EventEmitter<MicrophoneRecorderEvents> {
  private static hasRegisteredProcessor = false;

  private audioContext?: AudioContext;

  private source?: MediaStreamAudioSourceNode;

  private pcmWorker?: AudioWorkletNode;

  private audioTrack?: MediaStreamTrack;

  public sampleRate = 16000;

  constructor(opts?: { sampleRate?: number }) {
    super();
    if (opts && opts.sampleRate) {
      this.sampleRate = opts.sampleRate;
    }
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: "default",
        sampleRate: this.sampleRate,
        sampleSize: 16,
        channelCount: 1,
      },
      video: false,
    });

    this.audioTrack = stream.getAudioTracks().at(0);
    if (!this.audioTrack) {
      throw new Error(
        "Could not get an audio track to use for speech recognition",
      );
    }
    const trackSampleRate = this.audioTrack.getSettings().sampleRate;
    if (trackSampleRate) {
      this.sampleRate = trackSampleRate;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
        latencyHint: "interactive",
      });
    }

    if (!MicrophoneRecorder.hasRegisteredProcessor) {
      const blob = new Blob([pcmProcessor], { type: "text/javascript" });
      const blobURL = window.URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(blobURL);

      MicrophoneRecorder.hasRegisteredProcessor = true;
    }

    if (this.audioContext.state !== "running") {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(stream);
    this.pcmWorker = new AudioWorkletNode(this.audioContext, "pcm-worker", {
      outputChannelCount: [1],
    });
    this.source.connect(this.pcmWorker);
    this.pcmWorker.port.onmessage = (event) => {
      const data = event.data as Int16Array;
      this.emit("data", data.buffer);
    };
    this.pcmWorker.port.start();

    this.emit("start");
  }

  stop() {
    this.pcmWorker?.port.close();
    this.source?.disconnect();
    this.audioTrack?.stop();
    this.emit("end");
  }
}

export default MicrophoneRecorder;
