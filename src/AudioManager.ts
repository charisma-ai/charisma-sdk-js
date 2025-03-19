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
  debugLogFunction?: (message: string) => void;
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

  private debugLogFunction: (message: string) => void;

  constructor(options: AudioManagerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.debugLogFunction = options.debugLogFunction || (() => {});
    this.debugLogFunction("AudioManager running constructor");
    this.duckVolumeLevel = options.duckVolumeLevel ?? 0;
    this.normalVolumeLevel = options.normalVolumeLevel ?? 1;
    this.sttService = options.sttService ?? "charisma/deepgram";

    this.audioInputsService = new AudioInputsService(
      options.streamTimeslice,
      options.reconnectAttemptsTimeout,
      options.sttUrl,
      this.debugLogFunction,
    );
    this.audioInputsBrowser = new AudioInputsBrowser();
    this.audioOutputsService = new AudioOutputsService(this.debugLogFunction);
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
        this.audioOutputsService.setVolume(
          this.audioOutputsService.currentVolume,
        );
      }
    });
    this.audioOutputsService.on("stop", () => {
      if (this.microphoneIsOn) {
        this.audioOutputsService.setVolume(0);
      } else {
        this.audioOutputsService.setVolume(
          this.audioOutputsService.currentVolume,
        );
      }
    });
    this.debugLogFunction("AudioManager finished constructor");
  }

  // **
  // ** Audio Input ** //
  // **
  public startListening = (timeout?: number): void => {
    this.debugLogFunction("AudioManager startListening");
    if (this.sttService === "browser") {
      this.audioInputsBrowser.startListening(timeout);
    } else if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.startListening(timeout);
    }

    this.microphoneIsOn = true;
    this.audioOutputsService.setVolume(0);

    if (this.audioTrackManager.isPlaying) {
      this.audioTrackManager.setVolume(this.duckVolumeLevel);
    }
  };

  public stopListening = (): void => {
    this.debugLogFunction("AudioManager stopListening");
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
    this.debugLogFunction("AudioManager connect");
    if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.connect(token, playerSessionId);
    }
  };

  public disconnect = (): void => {
    this.debugLogFunction("AudioManager disconnect");
    if (this.sttService === "charisma/deepgram") {
      this.audioInputsService.disconnect();
    }
  };

  public resetTimeout = (timeout: number): void => {
    this.debugLogFunction("AudioManager resetTimeout");
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
    this.debugLogFunction("AudioManager browserIsSupported");
    return this.audioInputsBrowser.isSupported;
  };

  // **
  // ** Initialise Audio
  // **
  public initialise = (): void => {
    this.debugLogFunction("AudioManager initialise");
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
    this.debugLogFunction("AudioManager outputServicePlay");
    return this.audioOutputsService.play(audio, options);
  };

  public outputServiceSetVolume = (volume: number): void => {
    this.debugLogFunction("AudioManager outputServiceSetVolume");
    this.audioOutputsService.setVolume(volume);
  };

  // **
  // ** Audio Track Manager ** //
  // **
  public mediaAudioPlay = (audioTracks: AudioTrack[]): void => {
    this.debugLogFunction("AudioManager mediaAudioPlay");
    this.audioTrackManager.play(audioTracks);
  };

  public mediaAudioSetVolume = (volume: number): void => {
    this.debugLogFunction("AudioManager mediaAudioSetVolume");
    this.audioTrackManager.setVolume(volume);
  };

  public mediaAudioToggleMute = (): void => {
    this.debugLogFunction("AudioManager mediaAudioToggleMute");
    this.audioTrackManager.toggleMute();
  };

  public mediaAudioStopAll = (): void => {
    this.debugLogFunction("AudioManager mediaAudioStopAll");
    this.audioTrackManager.stopAll();
  };

  /**
   * Gets a MediaStream representing the current audio output.
   * This can be used for visualization purposes.
   * @returns MediaStream or null if audio context is not initialized
   */
  public getAudioStream = (): MediaStream | null | undefined => {
    this.debugLogFunction("AudioManager getAudioStream");
    return this.audioOutputsService.getAudioStream();
  };

  /**
   * Disconnects a previously connected audio stream destination
   * @param destination The AudioNode to disconnect
   */
  public disconnectAudioStream = (destination: AudioNode): void => {
    this.debugLogFunction("AudioManager disconnectAudioStream");
    this.audioOutputsService.disconnectAudioStream(destination);
  };

  /**
   * Gets the analyser node that can be used for audio visualization
   * @returns AnalyserNode or null if audio context is not initialized
   */
  public getAnalyserNode = (): AnalyserNode | null => {
    this.debugLogFunction("AudioManager getAnalyserNode");
    return this.audioOutputsService.getAnalyserNode();
  };
}

export default AudioManager;
