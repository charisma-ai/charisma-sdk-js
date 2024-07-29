class MediaAudio extends Audio {
  public isPlaying: boolean;

  constructor() {
    super();
    this.isPlaying = false;
  }

  public async play(): Promise<void> {
    this.isPlaying = true;
    await super.play();
  }

  public pause(): void {
    this.isPlaying = false;
    super.pause();
  }
}

export default MediaAudio;
