import { AudioTrack } from "./types";

class MediaAudio {
  public isPlaying: boolean;

  private currentAudio: HTMLAudioElement[];

  constructor() {
    this.isPlaying = false;
    this.currentAudio = [];
  }

  public play(audioTracks: AudioTrack[]): void {
    if (audioTracks.length === 0) return;

    this.isPlaying = true;

    audioTracks.forEach((audioTrack) => {
      if (!audioTrack.url) return;

      const audio = new Audio(audioTrack.url);
      audio.loop = audioTrack.loop;
      audio.volume = audioTrack.volume;
      audio.fastSeek(0);
      audio.play();
      audio.onended = () => {
        console.log("ended");
        if (audioTrack.behaviour === "restart") {
          audio.play();
        } else {
          this.currentAudio = this.currentAudio.filter(
            (currentAudio) => currentAudio !== audio,
          );
        }
      };
      this.currentAudio.push(audio);
    });
  }

  public pause(): void {
    this.isPlaying = false;
    this.currentAudio.forEach((audio) => {
      audio.pause();
    });
  }

  public stopAll(): void {
    this.currentAudio.forEach((audio) => {
      audio.pause();
    });
    this.currentAudio = [];
    this.isPlaying = false;
  }

  public toggleMute(): void {
    this.currentAudio.forEach((audio) => {
      // eslint-disable-next-line no-param-reassign
      audio.muted = !audio.muted;
    });
  }

  public setVolume(volume: number): void {
    this.currentAudio.forEach((audio) => {
      // eslint-disable-next-line no-param-reassign
      audio.volume = volume;
    });
  }
}

export default MediaAudio;
