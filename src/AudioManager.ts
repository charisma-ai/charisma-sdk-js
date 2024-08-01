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

  private options: AudioManagerOptions;

  constructor(options: AudioManagerOptions) {
    this.audioInputsService = new AudioInputsService();
    this.audioInputsBrowser = new AudioInputsBrowser();
    this.audioOutputsService = new AudioOutputsService();
    this.mediaAudio = new MediaAudio();

    this.options = {
      duckVolumeLevel: options.duckVolumeLevel ?? 0,
      normalVolumeLevel: options.normalVolumeLevel ?? 1,
      sttService: options.sttService ?? "charisma/deepgram",
      streamTimeslice: options.streamTimeslice ?? 100,
      handleStartSTT: options.handleStartSTT,
      handleStopSTT: options.handleStopSTT,
      handleTranscript: options.handleTranscript,
      handleError:
        options.handleError ??
        ((error: string) => console.error("Error:", error)),
    };

    // Listen to events from the AudioInputsService
    this.audioInputsService.on("start", this.options.handleStartSTT);
    this.audioInputsService.on("stop", this.options.handleStopSTT);
    this.audioInputsService.on("transcript", this.options.handleTranscript);
    this.audioInputsService.on("error", (error: string) =>
      this.options.handleError?.(error),
    );

    // Listen to events from the AudioInputsBrowser
    this.audioInputsBrowser.on("start", this.options.handleStartSTT);
    this.audioInputsBrowser.on("stop", this.options.handleStopSTT);
    this.audioInputsBrowser.on("transcript", this.options.handleTranscript);
    this.audioInputsBrowser.on("error", (error: string) =>
      this.options.handleError?.(error),
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
      this.mediaAudio.volume = this.options.duckVolumeLevel as number;
    }
  };

  public stopListening = (): void => {
    if (this.options.sttService === "browser") {
      this.audioInputsBrowser.stopListening();
    } else if (this.options.sttService === "charisma/deepgram") {
      this.audioInputsService.stopListening();
    }

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.normalVolumeLevel as number;
    }
  };

  public connect = (token: string): void => {
    if (this.options.sttService === "charisma/deepgram") {
      this.audioInputsService.connect(token);
    }
  };

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
