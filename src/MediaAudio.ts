class MediaAudio extends Audio {
  public originalVolume: number;

  public url: string;

  constructor(url: string, originalVolume: number) {
    super(url);
    this.url = url;
    this.originalVolume = originalVolume;
    this.volume = originalVolume;
  }

  public setVolume(volume: number): void {
    // Sets the volume relative to the original volume set in the graph editor.
    this.volume = this.originalVolume * volume;
  }
}

export default MediaAudio;
