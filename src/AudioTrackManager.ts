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
  }[];

  private muted = false;

  constructor() {
    this.isPlaying = false;
    this.currentAudio = [];
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | undefined> {
    if (this.audioContext === undefined) return undefined;

    const response = fetch(url);
    const arrayBuffer = await (await response).arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  private playNewSource(audioTrack: AudioTrack): void {
    if (!audioTrack.url) return;

    this.loadAudioBuffer(audioTrack.url).then((audioBuffer) => {
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

      if (!audioTrack.url) return;
      this.currentAudio.push({ source, gainNode, url: audioTrack.url });
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

  public play(audioTracks: AudioTrack[]) {
    if (audioTracks.length === 0) return;
    if (this.audioContext === undefined) {
      this.getAudioContext();
    }

    this.isPlaying = true;

    audioTracks.forEach((audioTrack) => {
      if (!audioTrack.url) return;

      const index = this.currentAudio.findIndex(
        (currentAudio) => currentAudio.url === audioTrack.url,
      );

      if (index === -1) {
        this.playNewSource(audioTrack);
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
          this.playNewSource(audioTrack);
        }
      }
    });
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
    this.currentAudio.forEach(({ gainNode }) => {
      // eslint-disable-next-line no-param-reassign
      gainNode.gain.value = volume;
    });
  }
}

export default AudioTrackManager;
