class MediaAudio extends Audio {
  public originalVolume: number;

  constructor(url: string) {
    super(url);
    this.originalVolume = this.volume;
  }

  public setVolume(volume: number): void {
    // Sets the volume relative to the original volume set in the graph editor.
    this.volume = this.originalVolume * volume;
  }
}

export default MediaAudio;
