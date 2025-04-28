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

  private muteGainNode: GainNode | null = null;

  private volumeGainNode: GainNode | null = null;

  private analyserNode: AnalyserNode | null = null;

  public normalVolume = 1;

  private currentSources: AudioOutputsServiceSource[] = [];

  private debugLogFunction: (message: string) => void;

  // NEW: Track start time and playing status
  private startTime: number | null = null;

  private isPlaying = false;

  constructor(debugLogFunction: (message: string) => void) {
    super();
    this.debugLogFunction = debugLogFunction;
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

    this.muteGainNode = this.audioContext.createGain();
    this.volumeGainNode = this.audioContext.createGain();
    this.analyserNode = this.audioContext.createAnalyser();

    this.muteGainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
    this.volumeGainNode.gain.setValueAtTime(
      this.normalVolume,
      this.audioContext.currentTime,
    );

    this.volumeGainNode.connect(this.muteGainNode);
    this.muteGainNode.connect(this.analyserNode);
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

  public setNormalVolume = (volume: number): void => {
    this.debugLogFunction(`AudioOutputsService setNormalVolume ${volume}`);
    if (!this.volumeGainNode || !this.audioContext) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.normalVolume = clampedVolume;

    this.volumeGainNode.gain.setValueAtTime(
      this.volumeGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.volumeGainNode.gain.linearRampToValueAtTime(
      clampedVolume,
      this.audioContext.currentTime + 0.1,
    );
  };

  public beginMuting = (): void => {
    this.debugLogFunction(`AudioOutputsService beginMuting`);
    if (!this.muteGainNode || !this.audioContext) return;

    this.muteGainNode.gain.setValueAtTime(
      this.muteGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.muteGainNode.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + 0.05,
    );
  };

  public endMuting = (): void => {
    this.debugLogFunction(`AudioOutputsService endMuting`);
    if (!this.muteGainNode || !this.audioContext) return;

    this.muteGainNode.gain.setValueAtTime(
      this.muteGainNode.gain.value,
      this.audioContext.currentTime,
    );
    this.muteGainNode.gain.linearRampToValueAtTime(
      1,
      this.audioContext.currentTime + 0.01,
    );
  };
}

export default AudioOutputsService;
