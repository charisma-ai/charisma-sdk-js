import { AudioTrack } from "./types";
import MediaAudio from "./MediaAudio";

class AudioTrackManager {
  public isPlaying: boolean;

  private currentAudio: MediaAudio[];

  constructor() {
    this.isPlaying = false;
    this.currentAudio = [];
  }

  public play(audioTracks: AudioTrack[]): void {
    if (audioTracks.length === 0) return;

    this.isPlaying = true;

    audioTracks.forEach((audioTrack) => {
      if (!audioTrack.url) return;

      // Get the index of this current audio track if it exists.
      const index = this.currentAudio.findIndex(
        (currentAudio) => currentAudio.url === audioTrack.url,
      );

      // If the track already exists in currentAudio
      if (index === -1) {
        const audio = new MediaAudio(audioTrack.url);

        audio.loop = audioTrack.loop;
        audio.volume = audioTrack.volume;
        audio.originalVolume = audio.volume;
        audio.fastSeek(0);
        audio.play();
        audio.onended = () => {
          this.currentAudio = this.currentAudio.filter(
            (currentAudio) => currentAudio !== audio,
          );
        };

        this.currentAudio.push(audio);
      } else {
        // Check for tracks that need to stop playing.
        if (audioTrack.stopPlaying) {
          this.currentAudio[index].pause();
          this.currentAudio = this.currentAudio.filter(
            (currentAudio) => currentAudio.url !== audioTrack.url,
          );
          return;
        }

        // Check if any tracks need to be restarted.
        if (audioTrack.behaviour === "restart") {
          if (index !== -1) {
            this.currentAudio[index].fastSeek(0);
          }
        }
      }
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
      audio.setVolume(volume);
    });
  }
}

export default AudioTrackManager;
