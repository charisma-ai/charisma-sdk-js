import MediaAudio from "./MediaAudio";
import AudioInputsService from "./AudioInputsService";
import AudioOutputsService, {
  AudioOutputsServicePlayOptions,
} from "./AudioOutputsService";
import BrowserSttService from "./BrowserSttService";

interface AudioManagerOptions {
  duckVolumeLevel: number;
  normalVolumeLevel: number;
  sttService: "browser" | "deepgram";
  streamTimeslice: number;
}

class AudioManager {
  public audioInputsService: AudioInputsService;

  public audioInputsBrowser: BrowserSttService;

  public audioOutputsService: AudioOutputsService;

  public mediaAudio: MediaAudio;

  private options: AudioManagerOptions;

  constructor(options: AudioManagerOptions) {
    this.audioInputsService = new AudioInputsService();
    this.audioInputsBrowser = new BrowserSttService();
    this.audioOutputsService = new AudioOutputsService();
    this.mediaAudio = new MediaAudio();

    this.options = {
      duckVolumeLevel: options.duckVolumeLevel || 0,
      normalVolumeLevel: options.normalVolumeLevel || 1,
      sttService: options.sttService || "deepgram",
      streamTimeslice: options.streamTimeslice || 100,
    };
  }

  // **
  // ** Audio Input Service ** //
  // **
  public inputServiceStartListening() {
    this.audioInputsService.startListening();

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.duckVolumeLevel;
    }
  }

  public inputServiceStopListening() {
    this.audioInputsService.stopListening();

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.normalVolumeLevel;
    }
  }

  public inputServiceConnect(token: string) {
    this.audioInputsService.connect(token);
  }

  public inputServiceResetTimeout(timeout: number) {
    this.audioInputsService.resetTimeout(timeout);
  }

  // **
  // ** Browser STT Service ** //
  // **
  public browserIsSupported() {
    return this.audioInputsBrowser.isSupported;
  }

  public browserStartListening() {
    this.audioInputsBrowser.startListening();

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.duckVolumeLevel;
    }
  }

  public browserStopListening() {
    this.audioInputsBrowser.stopListening();

    if (this.mediaAudio.isPlaying) {
      this.mediaAudio.volume = this.options.normalVolumeLevel;
    }
  }

  public browserResetTimeout(timeout: number) {
    this.audioInputsBrowser.resetTimeout(timeout);
  }

  // **
  // ** Audio Outputs Service ** //
  // **
  public outputServiceGetAudioContext() {
    return this.audioOutputsService.getAudioContext();
  }

  public outputServicePlay(
    audio: ArrayBuffer,
    options: boolean | AudioOutputsServicePlayOptions,
  ): Promise<void> {
    return this.audioOutputsService.play(audio, options);
  }

  // **
  // ** Media Audio ** //
  // **
  public mediaAudioPlay() {
    this.mediaAudio.play();
  }

  public mediaAudioPause() {
    this.mediaAudio.pause();
  }

  public mediaAudioFastSeek(time: number) {
    this.mediaAudio.fastSeek(time);
  }
}

export default AudioManager;
