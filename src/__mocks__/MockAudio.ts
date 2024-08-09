export default class MockAudio {
  public isPlaying = false;

  public volume = 1;

  public src = "";

  public muted = false;

  public play = jest.fn().mockResolvedValue(undefined);

  public pause = jest.fn();

  public fastSeek = jest.fn();

  public loop = false;
}
