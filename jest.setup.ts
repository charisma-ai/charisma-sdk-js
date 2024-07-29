class MockAudio {
  public isPlaying = false;

  public volume = 1;

  public currentTime = 0;

  public duration = 0;

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  fastSeek(time: number) {
    this.currentTime = time;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
(globalThis as any).Audio = MockAudio;
