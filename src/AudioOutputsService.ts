import { EventEmitter } from "eventemitter3";

interface Constructable<T> {
  new (): T;
}

interface WindowWithAudioContext extends Window {
  AudioContext?: Constructable<AudioContext>;
  webkitAudioContext?: Constructable<AudioContext>;
}

declare const window: WindowWithAudioContext;

type AudioOutputsServiceEvents = {
  start: [];
  stop: [];
};

export type AudioOutputsServicePlayOptions = {
  /**
   * Whether to interrupt the same track as the `trackId` passed (`track`), all currently playing audio (`all`), or not to interrupt anything (`none`). Default is `none`.
   */
  interrupt?: "track" | "all" | "none";
  /**
   * If you want to prevent a particular character to speak over themselves, a `trackId` can be set to a unique string. When playing another speech clip, if the same `trackId` is passed and `interrupt` is set to `true`, then the previous clip will stop playing. Default is unset.
   */
  trackId?: string;
};

type AudioOutputsServiceSource = {
  sourceNode: AudioBufferSourceNode;
  trackId?: string;
};

class AudioOutputsService extends EventEmitter<AudioOutputsServiceEvents> {
  private audioContext: AudioContext | undefined;

  private currentSources: AudioOutputsServiceSource[] = [];

  public getAudioContext = (): AudioContext => {
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

  public play = async (
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions = {},
  ): Promise<void> => {
    // Backwards-compatible with the old boolean `interrupt` parameter
    if (typeof options === "boolean") {
      console.warn(
        "Passing a boolean as the second parameter to `speaker.play()` is deprecated, and should be updated to use an `options` object.",
      );
      // eslint-disable-next-line no-param-reassign
      options = { interrupt: options ? "all" : "none" };
    }

    const { interrupt = "none", trackId } = options;

    const audioContext = this.getAudioContext();
    const source = audioContext.createBufferSource();
    source.connect(audioContext.destination);
    source.buffer = await new Promise((resolve, reject): void => {
      audioContext.decodeAudioData(audio, resolve, reject);
    });

    if (audioContext.state !== "running") {
      // This could be because the user hasn't given permission for the context to run
      // i.e. `state` is `suspended`
      // Instead of waiting for eternity, let's resolve immediately
      return Promise.resolve();
    }

    return new Promise((resolve): void => {
      source.onended = (): void => {
        resolve();
        this.currentSources = this.currentSources.filter(
          (currentSource) => currentSource.sourceNode !== source,
        );
        if (this.currentSources.length === 0) {
          this.emit("stop");
        }
      };
      if (this.currentSources.length > 0 && interrupt !== "none") {
        this.currentSources.forEach((currentSource) => {
          if (
            interrupt === "all" ||
            (interrupt === "track" && currentSource.trackId === trackId)
          ) {
            currentSource.sourceNode.stop();
          }
        });
      }
      if (this.currentSources.length === 0) {
        this.emit("start");
      }
      this.currentSources.push({ sourceNode: source, trackId });
      source.start();
    });
  };
}

export default AudioOutputsService;
