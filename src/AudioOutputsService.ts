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

  private gainNode: GainNode | undefined;

  private analyserNode: AnalyserNode | undefined;

  private currentSources: AudioOutputsServiceSource[] = [];

  private debugLogFunction: (message: string) => void;

  public currentVolume = 1;

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

    // Create and store the gain node.
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.currentVolume;

    // Create and store the analyser node
    this.analyserNode = this.audioContext.createAnalyser();

    // Connect the gain node to the analyser node and then to the destination
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    return this.audioContext;
  };

  /**
   * Gets the analyser node that can be used for audio visualization
   * @returns AnalyserNode or null if audio context is not initialized
   */
  public getAnalyserNode = (): AnalyserNode | null => {
    this.debugLogFunction("AudioOutputsService getAnalyserNode");
    if (!this.analyserNode) {
      try {
        // Try to initialize the audio context if it's not already initialized
        this.getAudioContext();
      } catch (error) {
        console.error("Failed to initialize audio context:", error);
        return null;
      }
    }
    return this.analyserNode || null;
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

    // Assert that gainNode is not undefined
    if (!this.gainNode) {
      throw new Error("GainNode is not initialized.");
    }

    const source = audioContext.createBufferSource();
    source.connect(this.gainNode);
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

  public setVolume = (volume: number): void => {
    this.debugLogFunction(`AudioOutputsService setVolume ${volume}`);
    if (!this.gainNode) return;

    // Clamp the volume to the range [0, 1]
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Store the volume value
    this.currentVolume = clampedVolume;

    // Set the gain value
    this.gainNode.gain.value = clampedVolume;
  };

  public getVolume = (): number => {
    this.debugLogFunction("AudioOutputsService getVolume");
    return this.currentVolume;
  };

  /**
   * Gets a MediaStream representing the current audio output.
   * This can be used for visualization purposes.
   * @returns MediaStream or null if audio context or gain node is not initialized
   */
  public getAudioStream = (): MediaStream | null => {
    this.debugLogFunction("AudioOutputsService getAudioStream");

    if (!this.audioContext || !this.gainNode) return null;

    // Create a MediaStreamDestination to capture the audio
    const streamDestination = this.audioContext.createMediaStreamDestination();

    // Connect the gain node (which all audio passes through) to the destination
    this.gainNode.connect(streamDestination);

    return streamDestination.stream;
  };

  // disconnect the gain node from a destination node
  public disconnectAudioStream = (destination: AudioNode): void => {
    this.debugLogFunction("AudioOutputsService disconnectAudioStream");

    if (!this.gainNode) return;

    this.gainNode.disconnect(destination);
  };
}

export default AudioOutputsService;