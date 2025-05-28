import AudioTrackManager from "./AudioTrackManager.js";
import AudioInputsService from "./AudioInputsService.js";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService.js";
import AudioInputsBrowser from "./AudioInputsBrowser.js";
import { AudioTrack } from "./types.js";

export interface AudioManagerOptions {
  duckVolumeLevel?: number;
  sttService?: "browser" | "charisma/deepgram";
  streamTimeslice?: number;
  reconnectAttemptsTimeout?: number;
  sttUrl?: string;
  muteCharacterAudio?: boolean;
  handleStartSTT?: () => void;
  handleStopSTT?: () => void;
  handleTranscript?: (transcript: string) => void;
  handleInterimTranscript?: (transcript: string) => void;
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

  private sttService: "browser" | "charisma/deepgram";

  private microphoneIsOn = false;

  private debugLogFunction: (message: string) => void;

  constructor(options: AudioManagerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.debugLogFunction = options.debugLogFunction || (() => {});
    this.debugLogFunction("AudioManager running constructor");
    this.duckVolumeLevel = options.duckVolumeLevel ?? 0;
    this.sttService = options.sttService ?? "charisma/deepgram";

    this.audioInputsService = new AudioInputsService(
      options.streamTimeslice,
      options.reconnectAttemptsTimeout,
      options.sttUrl,
      this.debugLogFunction,
    );
    this.audioInputsBrowser = new AudioInputsBrowser();
    const muteCharacterAudio = !!options.muteCharacterAudio;
    this.audioOutputsService = new AudioOutputsService(
      this.debugLogFunction,
      muteCharacterAudio,
    );
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
    this.audioInputsService.on(
      "transcript-interim",
      options.handleInterimTranscript ??
        (() => console.log("handleInterimTranscript() is not setup.")),
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
    this.audioInputsBrowser.on(
      "transcript-interim",
      options.handleInterimTranscript ??
        (() => console.log("handleInterimTranscript() is not setup")),
    );
    this.audioInputsBrowser.on("error", options.handleError ?? console.error);

    // Listen to events from the AudioOutputsService
    this.audioOutputsService.on("start", () => {
      if (this.microphoneIsOn) {
        this.audioOutputsService.beginMutingForMicrophone();
      } else {
        this.audioOutputsService.endMutingForMicrophone();
      }
    });
    this.audioOutputsService.on("stop", () => {
      if (this.microphoneIsOn) {
        this.audioOutputsService.beginMutingForMicrophone();
      } else {
        this.audioOutputsService.endMutingForMicrophone();
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
    this.audioOutputsService.beginMutingForMicrophone();

    if (this.audioTrackManager.isPlaying) {
      this.audioTrackManager.duckTo(this.duckVolumeLevel);
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

    this.audioOutputsService.endMutingForMicrophone();

    if (this.audioTrackManager.isPlaying) {
      this.audioTrackManager.duckOff();
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
    const outputContext = this.audioOutputsService.getAudioContext();
    const trackContext = this.audioTrackManager.getAudioContext();
    const resumeAudio = () => {
      outputContext.resume();
      trackContext.resume();
    };
    document.addEventListener("pointerdown", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });
  };

  // **
  // ** Audio Outputs Service ** //
  // **
  public playCharacterSpeech = (
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions,
  ): Promise<void> => {
    this.debugLogFunction("AudioManager playCharacterSpeech");
    return this.audioOutputsService.play(audio, options);
  };

  public get characterSpeechVolume(): number {
    return this.audioOutputsService.normalVolume;
  }

  public set characterSpeechVolume(volume: number) {
    this.audioOutputsService.normalVolume = volume;
  }

  public get characterSpeechIsMuted(): boolean {
    return this.audioOutputsService.isMutedByClient;
  }

  public set characterSpeechIsMuted(value: boolean) {
    this.debugLogFunction(`AudioManager characterSpeechIsMuted set ${value}`);
    this.audioOutputsService.setIsMutedByClient(value);
  }

  // **
  // ** Audio Track Manager ** //
  // **
  public mediaAudioPlay = (audioTracks: AudioTrack[]): void => {
    this.debugLogFunction("AudioManager mediaAudioPlay");
    this.audioTrackManager.play(audioTracks);
  };

  public get mediaAudioVolume(): number {
    return this.audioTrackManager.normalVolume;
  }

  public set mediaAudioVolume(volume: number) {
    this.audioTrackManager.normalVolume = volume;
  }

  public get mediaAudioIsMuted(): boolean {
    return this.audioTrackManager.isMutedByClient;
  }

  public set mediaAudioIsMuted(value: boolean) {
    this.debugLogFunction(`AudioManager characterSpeechIsMuted set ${value}`);
    this.audioTrackManager.isMutedByClient = value;
  }

  public mediaAudioStopAll = (): void => {
    this.debugLogFunction("AudioManager mediaAudioStopAll");
    this.audioTrackManager.stopAll();
  };
}

export default AudioManager;
