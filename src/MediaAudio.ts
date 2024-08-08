class MediaAudio extends Audio {
  public originalVolume: number;

  public url: string;

  constructor(url: string) {
    super(url);
    this.originalVolume = this.volume;
    this.url = url;
  }

  public setVolume(volume: number): void {
    // Sets the volume relative to the original volume set in the graph editor.
    this.volume = this.originalVolume * volume;
  }
}

export default MediaAudio;
