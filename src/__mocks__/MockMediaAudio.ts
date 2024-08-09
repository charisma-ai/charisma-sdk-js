export default class MockMediaAudio {
  static play = jest.fn();

  static pause = jest.fn();

  public isPlaying = false;

  static volume = 1;

  public src = "";

  public muted = false;

  static loop: boolean;

  static setVolume = jest.fn().mockImplementation((volume: number) => {
    this.volume = volume;
  });
}
