import { EventEmitter } from "eventemitter3";
import MediaAudio from "./MediaAudio";
import AudioInputsService from "./AudioInputsService";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService";
import AudioInputsBrowser from "./AudioInputsBrowser";

export interface AudioManagerOptions {
  duckVolumeLevel: number;
  normalVolumeLevel: number;
  sttService: "browser" | "charisma/deepgram";
  streamTimeslice: number;
}

type AudioManagerEvents = {
  start: [];
  transcript: [string];
  error: [string];
  stop: [];
};

class AudioManager extends EventEmitter<AudioManagerEvents> {
  private audioInputsService: AudioInputsService;

  private audioInputsBrowser: AudioInputsBrowser;

  private audioOutputsService: AudioOutputsService;

  private mediaAudio: MediaAudio;

  private options: AudioManagerOptions;

  constructor(options: AudioManagerOptions) {
    super();
    this.audioInputsService = new AudioInputsService();
    this.audioInputsBrowser = new AudioInputsBrowser();
    this.audioOutputsService = new AudioOutputsService();
    this.mediaAudio = new MediaAudio();

    this.options = {
      duckVolumeLevel: options.duckVolumeLevel ?? 0,
      normalVolumeLevel: options.normalVolumeLevel ?? 1,
      sttService: options.sttService ?? "charisma/deepgram",
      streamTimeslice: options.streamTimeslice ?? 100,
    };

    // Listen to events from the AudioInputsService
    this.audioInputsService.on("start", () => this.emit("start"));
    this.audioInputsService.on("stop", () => this.emit("stop"));
    this.audioInputsService.on("transcript", (transcript: string) =>
      this.emit("transcript", transcript),
    );
    this.audioInputsService.on("error", (error: string) =>
      this.emit("error", error),
    );

    // Listen to events from the AudioInputsBrowser
    this.audioInputsBrowser.on("start", () => this.emit("start"));
    this.audioInputsBrowser.on("stop", () => this.emit("stop"));
    this.audioInputsBrowser.on("transcript", (transcript: string) =>
      this.emit("transcript", transcript),
    );
    this.audioInputsBrowser.on("error", (error: string) =>
      this.emit("error", error),
    );
  }

  // **
  // ** Audio Input ** //
  // **
  public startListening = (token: string): void => {
    if (this.options.sttService === "browser") {
      this.audioInputsBrowser.startListening();
    } else if (this.options.sttService === "charisma/deepgram") {
      this.audioInputsService.startListening(token);
    }

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.duckVolumeLevel;
    }
  };

  public stopListening = (): void => {
    if (this.options.sttService === "browser") {
      this.audioInputsBrowser.stopListening();
    } else if (this.options.sttService === "charisma/deepgram") {
      this.audioInputsService.stopListening();
    }

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.normalVolumeLevel;
    }
  };

  // TODO - Remove this and connect automatically
  // public inputServiceConnect = (token: string) => {
  //   this.audioInputsService.connect(token);
  // };

  public inputServiceResetTimeout = (timeout: number): void => {
    this.audioInputsService.resetTimeout(timeout);
  };

  // **
  // ** Browser STT Service ** //
  // **
  public browserIsSupported = (): boolean => {
    return this.audioInputsBrowser.isSupported;
  };

  public browserResetTimeout = (timeout: number): void => {
    this.audioInputsBrowser.resetTimeout(timeout);
  };

  // **
  // ** Audio Outputs Service ** //
  // **
  public outputServicePlay = (
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions,
  ): Promise<void> => {
    return this.audioOutputsService.play(audio, options);
  };

  // **
  // ** Media Audio ** //
  // **
  public mediaAudioPlay = (): Promise<void> => {
    return this.mediaAudio.play();
  };

  public mediaAudioPause = (): void => {
    this.mediaAudio.pause();
  };

  public mediaAudioFastSeek = (time: number): void => {
    this.mediaAudio.fastSeek(time);
  };

  get mediaSrc() {
    return this.mediaAudio.src;
  }

  set mediaSrc(value: string | null) {
    if (value) {
      this.mediaAudio.src = value;
    } else {
      this.mediaAudio.src = "";
    }
  }

  get muted() {
    return this.mediaAudio.muted;
  }

  set muted(value: boolean) {
    this.mediaAudio.muted = value;
  }
}

export default AudioManager;
