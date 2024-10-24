import AudioTrackManager from "./AudioTrackManager.js";
import AudioInputsService from "./AudioInputsService.js";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService.js";
import AudioInputsBrowser from "./AudioInputsBrowser.js";
import { AudioTrack } from "./types.js";

export interface AudioManagerOptions {
  duckVolumeLevel?: number;
  normalVolumeLevel?: number;
  sttService?: "browser" | "charisma/deepgram";
  streamTimeslice?: number;
  reconnectAttemptsTimeout?: number;
  sttUrl?: string;
  handleStartSTT?: () => void;
  handleStopSTT?: () => void;
  handleTranscript?: (transcript: string) => void;
  handleError?: (error: string) => void;
  handleDisconnect?: (message: string) => void;
  handleConnect?: (message: string) => void;
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

    this.audioInputsService = new AudioInputsService(
      options.streamTimeslice,
      options.reconnectAttemptsTimeout,
      options.sttUrl,
    );
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
      options.handleDisconnect ?? console.error,
    );
    this.audioInputsService.on("connect", options.handleConnect ?? console.log);

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

  public connect = (token: string, playerSessionId: string): void => {
    if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.connect(token, playerSessionId);
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
  // ** Initialise Audio
  // **
  public initialise = (): void => {
    this.audioOutputsService.getAudioContext();
    this.audioTrackManager.getAudioContext();
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
    this.audioTrackManager.play(audioTracks);
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
