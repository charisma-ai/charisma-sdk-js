import EventEmitter from "eventemitter3";

interface Constructable<T> {
  new (): T;
}

interface WindowWithAudioContext extends Window {
  AudioContext?: Constructable<AudioContext>;
  webkitAudioContext?: Constructable<AudioContext>;
}

declare const window: WindowWithAudioContext;

type SpeakerEvents = "start" | "stop";

declare interface Speaker {
  on(event: "start", listener: () => void): this;
  on(event: "stop", listener: () => void): this;
}

class Speaker extends EventEmitter<SpeakerEvents> {
  private audioContext: AudioContext | undefined;

  private currentSources: AudioBufferSourceNode[] = [];

  private getAudioContext = (): AudioContext => {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AudioContext isn't supported in this browser.");
    }

    const audioContext = new AudioContextClass();
    this.audioContext = audioContext;
    return audioContext;
  };

  public play = async (audio: number[], interrupt = false): Promise<void> => {
    const audioContext = this.getAudioContext();
    const arrayBuffer = new Uint8Array(audio).buffer;
    const source = audioContext.createBufferSource();
    source.connect(audioContext.destination);
    source.buffer = await new Promise((resolve, reject): void => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
    return new Promise((resolve): void => {
      source.onended = (): void => {
        resolve();
        this.currentSources = this.currentSources.filter(
          currentSource => currentSource !== source,
        );
        if (this.currentSources.length === 0) {
          this.emit("stop");
        }
      };
      if (this.currentSources.length > 0 && interrupt) {
        this.currentSources.map(currentSource => currentSource.stop());
      }
      if (this.currentSources.length === 0) {
        this.emit("start");
      }
      this.currentSources.push(source);
      source.start();
    });
  };
}

export default Speaker;
