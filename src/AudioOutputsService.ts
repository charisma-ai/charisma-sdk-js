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

  private muteForMicrophoneGainNode: GainNode | null = null;

  private muteForClientGainNode: GainNode | null = null;

  private volumeGainNode: GainNode | null = null;

  private clientSetVolume = 1;

  public isMutedByClient: boolean;

  private currentSources: AudioOutputsServiceSource[] = [];

  private debugLogFunction: (message: string) => void;

  constructor(
    debugLogFunction: (message: string) => void,
    muteCharacterAudio: boolean,
  ) {
    super();
    this.debugLogFunction = debugLogFunction;
    this.isMutedByClient = muteCharacterAudio;
  }

  public getAudioContext = (): AudioContext => {
    this.debugLogFunction("AudioOutputsService getAudioContext");
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AudioContext isn't supported in this browser.");
    }

    this.audioContext = new AudioContextClass();

    // Create and store the gain nodes.
    this.muteForMicrophoneGainNode = this.audioContext.createGain();
    this.muteForClientGainNode = this.audioContext.createGain();
    this.volumeGainNode = this.audioContext.createGain();

    this.muteForMicrophoneGainNode.gain.setValueAtTime(
      1,
      this.audioContext.currentTime,
    );
    this.muteForClientGainNode.gain.setValueAtTime(
      this.isMutedByClient ? 0 : 1,
      this.audioContext.currentTime,
    );
    this.volumeGainNode.gain.setValueAtTime(
      this.normalVolume,
      this.audioContext.currentTime,
    );

    this.volumeGainNode.connect(this.muteForClientGainNode);
    this.muteForClientGainNode.connect(this.muteForMicrophoneGainNode);
    this.muteForMicrophoneGainNode.connect(this.audioContext.destination);

    return this.audioContext;
  };

  public play = async (
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions = {},
  ): Promise<void> => {
    this.debugLogFunction("AudioOutputsService play");

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

    if (!this.volumeGainNode) {
      throw new Error("volumeGainNode is not initialized.");
    }

    const source = audioContext.createBufferSource();
    source.connect(this.volumeGainNode);
    source.buffer = await new Promise((resolve, reject): void => {
      audioContext.decodeAudioData(audio, resolve, reject);
    });

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

  public get normalVolume(): number {
    return this.clientSetVolume;
  }

  public set normalVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    this.clientSetVolume = clampedVolume;

    if (!this.volumeGainNode || !this.audioContext) {
      return;
    }

    // smooth ramp to new value
    this.volumeGainNode.gain.setValueAtTime(
      this.volumeGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.volumeGainNode.gain.linearRampToValueAtTime(
      clampedVolume,
      this.audioContext.currentTime + 0.1,
    );
  }

  public setIsMutedByClient = (value: boolean): void => {
    this.debugLogFunction(`AudioOutputsService setIsMutedByClient ${value}`);

    this.isMutedByClient = value;

    if (!this.muteForClientGainNode || !this.audioContext) {
      return;
    }

    // smooth ramp to new value
    this.muteForClientGainNode.gain.setValueAtTime(
      this.muteForClientGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.muteForClientGainNode.gain.linearRampToValueAtTime(
      value ? 0 : 1,
      this.audioContext.currentTime + 0.1,
    );
  };

  public beginMutingForMicrophone = (): void => {
    this.debugLogFunction(`AudioOutputsService beginMuting`);
    if (!this.muteForMicrophoneGainNode || !this.audioContext) return;

    // Fade out quickly
    this.muteForMicrophoneGainNode.gain.setValueAtTime(
      this.muteForMicrophoneGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.muteForMicrophoneGainNode.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + 0.05,
    );
  };

  public endMutingForMicrophone = (): void => {
    this.debugLogFunction(`AudioOutputsService endMuting`);
    if (!this.muteForMicrophoneGainNode || !this.audioContext) return;

    // Fade in very quickly
    this.muteForMicrophoneGainNode.gain.setValueAtTime(
      this.muteForMicrophoneGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.muteForMicrophoneGainNode.gain.linearRampToValueAtTime(
      1,
      this.audioContext.currentTime + 0.01,
    );
  };
}

export default AudioOutputsService;
