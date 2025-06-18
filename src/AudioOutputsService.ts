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
  interrupt?: "track" | "all" | "none";
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

  private analyserNode: AnalyserNode | null = null;

  private clientSetVolume = 1;

  private clientSetMuted: boolean;

  private startTime: number | null = null;

  private isPlaying = false;

  private currentSources: AudioOutputsServiceSource[] = [];

  private debugLogFunction: (message: string) => void;

  constructor(
    debugLogFunction: (message: string) => void,
    muteCharacterAudio: boolean,
  ) {
    super();
    this.debugLogFunction = debugLogFunction;
    this.clientSetMuted = muteCharacterAudio;
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
    this.analyserNode = this.audioContext.createAnalyser();

    this.muteForMicrophoneGainNode.gain.setValueAtTime(
      1,
      this.audioContext.currentTime,
    );
    this.muteForClientGainNode.gain.setValueAtTime(
      this.clientSetMuted ? 0 : 1,
      this.audioContext.currentTime,
    );
    this.volumeGainNode.gain.setValueAtTime(
      this.normalVolume,
      this.audioContext.currentTime,
    );

    this.volumeGainNode.connect(this.muteForClientGainNode);
    this.muteForClientGainNode.connect(this.muteForMicrophoneGainNode);
    this.muteForMicrophoneGainNode.connect(this.audioContext.destination);
    this.analyserNode.connect(this.audioContext.destination);

    return this.audioContext;
  };

  public getAnalyserNode = (): AnalyserNode | null => {
    this.debugLogFunction("AudioOutputsService getAnalyserNode");
    return this.analyserNode || null;
  };

  // NEW: Get the current playback time in seconds
  public getCurrentPlaybackTime = (): number => {
    if (!this.audioContext || this.startTime === null || !this.isPlaying)
      return 0;
    return this.audioContext.currentTime - this.startTime;
  };

  // NEW: Get the current playing status
  public getIsPlaying = (): boolean => {
    return this.isPlaying;
  };

  public play = async (
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions = {},
  ): Promise<void> => {
    this.debugLogFunction("AudioOutputsService play");

    if (typeof options === "boolean") {
      console.warn(
        "Passing a boolean as the second parameter to `speaker.play()` is deprecated, and should be updated to use an `options` object.",
      );
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
          this.isPlaying = false; // NEW: Reset playing flag
          this.startTime = null; // NEW: Clear start time
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
        this.startTime = audioContext.currentTime; // NEW: Track when playback starts
        this.isPlaying = true; // NEW: Set playing flag
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

    this.volumeGainNode.gain.setValueAtTime(
      this.volumeGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.volumeGainNode.gain.linearRampToValueAtTime(
      clampedVolume,
      this.audioContext.currentTime + 0.1,
    );
  }

  public get isMutedByClient(): boolean {
    return this.clientSetMuted;
  }

  public set isMutedByClient(value: boolean) {
    this.debugLogFunction(`AudioOutputsService setIsMutedByClient ${value}`);

    this.clientSetMuted = value;

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
  }

  public beginMutingForMicrophone = (): void => {
    this.debugLogFunction(`AudioOutputsService beginMuting`);
    if (!this.muteForMicrophoneGainNode || !this.audioContext) return;

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
