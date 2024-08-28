import { AudioTrack } from "./types";

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

  public isPlaying: boolean;

  private currentAudio: {
    source: AudioBufferSourceNode;
    gainNode: GainNode;
    url: string;
    originalVolume: number;
  }[];

  private muted = false;

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

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = audioTrack.volume;

    const source = this.audioContext.createBufferSource();
    if (audioBuffer === undefined) return;
    source.buffer = audioBuffer;
    source.loop = audioTrack.loop;
    source.connect(gainNode).connect(this.audioContext.destination);
    source.start(0);

    source.onended = () => {
      this.currentAudio = this.currentAudio.filter(
        (currentAudio) => currentAudio.source !== source,
      );
    };

    this.currentAudio.push({
      source,
      gainNode,
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

    return this.audioContext;
  };

  public async play(audioTracks: AudioTrack[]): Promise<void> {
    if (audioTracks.length === 0) return;
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

  public toggleMute(): void {
    this.muted = !this.muted;

    this.currentAudio.forEach(({ gainNode }) => {
      // eslint-disable-next-line no-param-reassign
      gainNode.gain.value = this.muted ? 0 : 1;
    });
  }

  public setVolume(volume: number): void {
    this.currentAudio.forEach(({ gainNode, originalVolume }) => {
      // eslint-disable-next-line no-param-reassign
      gainNode.gain.value = originalVolume * volume;
    });
  }
}

export default AudioTrackManager;
