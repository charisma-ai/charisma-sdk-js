export default class MockAudioOutputsService {
  public play = jest.fn().mockResolvedValue(undefined);
}
