import { AudioTrack } from "./types.js";

interface Constructable<T> {
  new (): T;
}

interface WindowWithAudioContext extends Window {
  AudioContext?: Constructable<AudioContext>;
  webkitAudioContext?: Constructable<AudioContext>;
}

declare const window: WindowWithAudioContext;

class AudioTrackManager {
  private audioContext: AudioContext | undefined;

  private muteForClientGainNode: GainNode | null = null;

  private duckForMicrophoneGainNode: GainNode | null = null;

  private clientVolumeGainNode: GainNode | null = null;

  public isPlaying: boolean;

  private duckControlCurrentGainVolume = 1;

  private clientSetVolume = 1;

  private clientSetMuted = false;

  private currentAudio: {
    source: AudioBufferSourceNode;
    originalGainNode: GainNode;
    url: string;
    originalVolume: number;
  }[];

  constructor() {
    this.isPlaying = false;
    this.currentAudio = [];
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | undefined> {
    if (this.audioContext === undefined) return undefined;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  private async playNewSource(audioTrack: AudioTrack): Promise<void> {
    if (!audioTrack.url) return;

    const audioBuffer = await this.loadAudioBuffer(audioTrack.url);
    if (this.audioContext === undefined) return;

    const sourceGainNode = this.audioContext.createGain();
    sourceGainNode.gain.value = audioTrack.volume;

    const source = this.audioContext.createBufferSource();
    if (audioBuffer === undefined) return;
    source.buffer = audioBuffer;
    source.loop = audioTrack.loop;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    source.connect(sourceGainNode).connect(this.clientVolumeGainNode!);
    source.start(0);

    source.onended = () => {
      this.currentAudio = this.currentAudio.filter(
        (currentAudio) => currentAudio.source !== source,
      );

      if (this.currentAudio.length === 0) {
        this.isPlaying = false;
      }
    };

    this.currentAudio.push({
      source,
      originalGainNode: sourceGainNode,
      url: audioTrack.url,
      originalVolume: audioTrack.volume,
    });
  }

  public getAudioContext = (): AudioContext => {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AudioContext isn't supported in this browser.");
    }

    this.audioContext = new AudioContextClass();
    this.clientVolumeGainNode = this.audioContext.createGain();
    this.duckForMicrophoneGainNode = this.audioContext.createGain();
    this.muteForClientGainNode = this.audioContext.createGain();

    this.muteForClientGainNode.gain.setValueAtTime(
      this.clientSetMuted ? 0 : 1,
      this.audioContext.currentTime,
    );
    this.duckForMicrophoneGainNode.gain.setValueAtTime(
      this.duckControlCurrentGainVolume,
      this.audioContext.currentTime,
    );
    this.clientVolumeGainNode.gain.setValueAtTime(
      this.clientSetVolume,
      this.audioContext.currentTime,
    );

    this.muteForClientGainNode.connect(this.duckForMicrophoneGainNode);
    this.duckForMicrophoneGainNode.connect(this.clientVolumeGainNode);
    this.clientVolumeGainNode.connect(this.audioContext.destination);

    return this.audioContext;
  };

  public async play(audioTracks: AudioTrack[]): Promise<void> {
    if (audioTracks.length === 0) {
      return;
    }
    if (this.audioContext === undefined) {
      this.getAudioContext();
    }

    this.isPlaying = true;

    await Promise.all(
      audioTracks.map(async (audioTrack) => {
        if (!audioTrack.url) return;

        const index = this.currentAudio.findIndex(
          (currentAudio) => currentAudio.url === audioTrack.url,
        );

        if (index === -1) {
          await this.playNewSource(audioTrack);
        } else {
          if (audioTrack.stopPlaying) {
            this.currentAudio[index].source.stop();
            this.currentAudio = this.currentAudio.filter(
              (currentAudio) => currentAudio.url !== audioTrack.url,
            );
            return;
          }

          if (audioTrack.behaviour === "restart") {
            this.currentAudio[index].source.stop();
            this.currentAudio = this.currentAudio.filter(
              (currentAudio) => currentAudio.url !== audioTrack.url,
            );
            await this.playNewSource(audioTrack);
          }
        }
      }),
    );

    if (this.currentAudio.length === 0) {
      this.isPlaying = false;
    }
  }

  public pause(): void {
    this.isPlaying = false;
    this.currentAudio.forEach(({ source }) => {
      source.stop();
    });
  }

  public stopAll(): void {
    this.currentAudio.forEach(({ source }) => {
      source.stop();
    });
    this.currentAudio = [];
    this.isPlaying = false;
  }

  public get isMutedByClient(): boolean {
    return this.clientSetMuted;
  }

  public set isMutedByClient(muted: boolean) {
    this.clientSetMuted = muted;
    if (!this.audioContext || !this.muteForClientGainNode) {
      return;
    }
    this.muteForClientGainNode.gain.setValueAtTime(
      this.clientSetMuted ? 0 : 1,
      this.audioContext.currentTime + 0.1,
    );
  }

  public get normalVolume(): number {
    return this.clientSetVolume;
  }

  public set normalVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    this.clientSetVolume = clampedVolume;
    if (!this.audioContext || !this.clientVolumeGainNode) {
      return;
    }
    this.clientVolumeGainNode.gain.setValueAtTime(
      this.clientSetVolume,
      this.audioContext.currentTime + 0.1,
    );
  }

  public duckTo(volume: number): void {
    this.duckControlCurrentGainVolume = volume;
    if (!this.audioContext || !this.duckForMicrophoneGainNode) {
      return;
    }
    this.duckForMicrophoneGainNode.gain.setValueAtTime(
      this.duckControlCurrentGainVolume,
      this.audioContext.currentTime + 0.05,
    );
  }

  public duckOff(): void {
    this.duckControlCurrentGainVolume = 1;
    if (!this.audioContext || !this.duckForMicrophoneGainNode) {
      return;
    }
    this.duckForMicrophoneGainNode.gain.setValueAtTime(
      this.duckControlCurrentGainVolume,
      this.audioContext.currentTime + 0.01,
    );
  }
}

export default AudioTrackManager;
