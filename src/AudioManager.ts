import AudioTrackManager from "./AudioTrackManager";
import AudioInputsService from "./AudioInputsService";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService";
import AudioInputsBrowser from "./AudioInputsBrowser";
import { AudioTrack } from "./types";

export interface AudioManagerOptions {
  duckVolumeLevel?: number;
  normalVolumeLevel?: number;
  sttService?: "browser" | "charisma/deepgram";
  streamTimeslice?: number;
  handleStartSTT?: () => void;
  handleStopSTT?: () => void;
  handleTranscript?: (transcript: string) => void;
  handleError?: (error: string) => void;
  handleDisconnect?: () => void;
}

class AudioManager {
  private audioInputsService: AudioInputsService;

  private audioInputsBrowser: AudioInputsBrowser;

  private audioOutputsService: AudioOutputsService;

  private audioTrackManager: AudioTrackManager;

  private duckVolumeLevel: number;

  private normalVolumeLevel: number;

  private sttService: "browser" | "charisma/deepgram";

  private microphoneIsOn = false;

  constructor(options: AudioManagerOptions) {
    this.duckVolumeLevel = options.duckVolumeLevel ?? 0;
    this.normalVolumeLevel = options.normalVolumeLevel ?? 1;
    this.sttService = options.sttService ?? "charisma/deepgram";

    this.audioInputsService = new AudioInputsService(options.streamTimeslice);
    this.audioInputsBrowser = new AudioInputsBrowser();
    this.audioOutputsService = new AudioOutputsService();
    this.audioTrackManager = new AudioTrackManager();

    // Listen to events from the AudioInputsService
    this.audioInputsService.on(
      "start",
      options.handleStartSTT ??
        (() => console.error("handleStartSTT() is not setup")),
    );
    this.audioInputsService.on(
      "stop",
      options.handleStopSTT ??
        (() => console.error("handleStopSTT() is not setup")),
    );
    this.audioInputsService.on(
      "transcript",
      options.handleTranscript ??
        (() => console.error("handleTranscript() is not setup.")),
    );
    this.audioInputsService.on("error", options.handleError ?? console.error);
    this.audioInputsService.on(
      "disconnect",
      options.handleDisconnect ??
        (() => {
          console.error("Transcription service disconnected");
        }),
    );

    // Listen to events from the AudioInputsBrowser
    this.audioInputsBrowser.on(
      "start",
      options.handleStartSTT ??
        (() => console.error("handleStartSTT() is not setup")),
    );
    this.audioInputsBrowser.on(
      "stop",
      options.handleStopSTT ??
        (() => console.error("handleStopSTT() is not setup")),
    );
    this.audioInputsBrowser.on(
      "transcript",
      options.handleTranscript ??
        (() => console.error("handleTranscript() is not setup")),
    );
    this.audioInputsBrowser.on("error", options.handleError ?? console.error);

    // Listen to events from the AudioOutputsService
    this.audioOutputsService.on("start", () => {
      if (this.microphoneIsOn) {
        this.audioOutputsService.setVolume(0);
      } else {
        this.audioOutputsService.setVolume(1);
      }
    });
    this.audioOutputsService.on("stop", () => {
      if (this.microphoneIsOn) {
        this.audioOutputsService.setVolume(0);
      } else {
        this.audioOutputsService.setVolume(1);
      }
    });
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

    this.microphoneIsOn = true;
    this.audioOutputsService.setVolume(0);

    if (this.audioTrackManager.isPlaying) {
      this.audioTrackManager.setVolume(this.duckVolumeLevel);
    }
  };

  public stopListening = (): void => {
    if (this.sttService === "browser") {
      this.audioInputsBrowser.stopListening();
    } else if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.stopListening();
    }

    this.microphoneIsOn = false;

    if (this.audioTrackManager.isPlaying) {
      this.audioTrackManager.setVolume(this.normalVolumeLevel);
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
  // ** Audio Track Manager ** //
  // **
  public mediaAudioPlay = (audioTracks: AudioTrack[]): void => {
    return this.audioTrackManager.play(audioTracks);
  };

  public mediaAudioSetVolume = (volume: number): void => {
    this.audioTrackManager.setVolume(volume);
  };

  public mediaAudioToggleMute = (): void => {
    this.audioTrackManager.toggleMute();
  };

  public mediaAudioStopAll = (): void => {
    this.audioTrackManager.stopAll();
  };
}

export default AudioManager;
