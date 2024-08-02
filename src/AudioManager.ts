import MediaAudio from "./MediaAudio";
import AudioInputsService from "./AudioInputsService";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService";
import AudioInputsBrowser from "./AudioInputsBrowser";

export interface AudioManagerOptions {
  duckVolumeLevel?: number;
  normalVolumeLevel?: number;
  sttService?: "browser" | "charisma/deepgram";
  streamTimeslice?: number;
  handleStartSTT: () => void;
  handleStopSTT: () => void;
  handleTranscript: (transcript: string) => void;
  handleError?: (error: string) => void;
}

class AudioManager {
  private audioInputsService: AudioInputsService;

  private audioInputsBrowser: AudioInputsBrowser;

  private audioOutputsService: AudioOutputsService;

  private mediaAudio: MediaAudio;

  private duckVolumeLevel: number;

  private normalVolumeLevel: number;

  private sttService: "browser" | "charisma/deepgram";

  constructor(options: AudioManagerOptions) {
    this.duckVolumeLevel = options.duckVolumeLevel ?? 0;
    this.normalVolumeLevel = options.normalVolumeLevel ?? 1;
    this.sttService = options.sttService ?? "charisma/deepgram";

    this.audioInputsService = new AudioInputsService(options.streamTimeslice);
    this.audioInputsBrowser = new AudioInputsBrowser();
    this.audioOutputsService = new AudioOutputsService();
    this.mediaAudio = new MediaAudio();

    // Listen to events from the AudioInputsService
    this.audioInputsService.on("start", options.handleStartSTT);
    this.audioInputsService.on("stop", options.handleStopSTT);
    this.audioInputsService.on("transcript", options.handleTranscript);
    this.audioInputsService.on("error", options.handleError ?? console.error);

    // Listen to events from the AudioInputsBrowser
    this.audioInputsBrowser.on("start", options.handleStartSTT);
    this.audioInputsBrowser.on("stop", options.handleStopSTT);
    this.audioInputsBrowser.on("transcript", options.handleTranscript);
    this.audioInputsBrowser.on("error", options.handleError ?? console.error);
  }

  // **
  // ** Audio Input ** //
  // **
  public startListening = (): void => {
    if (this.sttService === "browser") {
      this.audioInputsBrowser.startListening();
    } else if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.startListening();
    }

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.duckVolumeLevel;
    }
  };

  public stopListening = (): void => {
    if (this.sttService === "browser") {
      this.audioInputsBrowser.stopListening();
    } else if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.stopListening();
    }

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.normalVolumeLevel;
    }
  };

  public connect = (token: string): void => {
    if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.connect(token);
    }
  };

  public resetTimeout = (timeout: number): void => {
    if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.resetTimeout(timeout);
    } else {
      this.audioInputsBrowser.resetTimeout(timeout);
    }
  };

  // **
  // ** Browser STT Service ** //
  // **
  public browserIsSupported = (): boolean => {
    return this.audioInputsBrowser.isSupported;
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
    this.mediaAudio.src = value ?? "";
  }

  get mediaMuted() {
    return this.mediaAudio.muted;
  }

  set mediaMuted(value: boolean) {
    this.mediaAudio.muted = value;
  }
}

export default AudioManager;
