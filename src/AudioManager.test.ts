import MockMediaAudio from "./__mocks__/MockMediaAudio";
import MockAudioInputsService from "./__mocks__/MockAudioInputsService";
import MockAudioInputsBrowser from "./__mocks__/MockAudioInputsBrowser";
import MockAudioOutputsService from "./__mocks__/MockAudioOutputsService";

import AudioManager, { AudioManagerOptions } from "./AudioManager";

jest.mock("./MediaAudio", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => MockMediaAudio),
}));

jest.mock("./AudioInputsService", () => ({
  __esModule: true,
  default: MockAudioInputsService,
}));

jest.mock("./AudioInputsBrowser", () => ({
  __esModule: true,
  default: MockAudioInputsBrowser,
}));

jest.mock("./AudioOutputsService", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => MockAudioOutputsService),
}));

describe("AudioManager", () => {
  test("should initialize correctly", () => {
    const mockOptions: AudioManagerOptions = {
      duckVolumeLevel: 0.2,
      normalVolumeLevel: 1,
      sttService: "browser",
      streamTimeslice: 100,
      handleError: jest.fn(),
      handleStartSTT: jest.fn(),
      handleStopSTT: jest.fn(),
      handleTranscript: jest.fn(),
    };
    const audioManager = new AudioManager(mockOptions);
    expect(audioManager).toBeInstanceOf(AudioManager);
  });
  // TODO better name
  test("inputServiceStartListening should call startListening on audioInputsBrowser", () => {
    const mockOptions: AudioManagerOptions = {
      duckVolumeLevel: 0.2,
      normalVolumeLevel: 1,
      sttService: "browser",
      streamTimeslice: 100,
      handleError: jest.fn(),
      handleStartSTT: jest.fn(),
      handleStopSTT: jest.fn(),
      handleTranscript: jest.fn(),
    };

    const mockAudioInputsBrowserInstance = new MockAudioInputsBrowser();
    const mockAudioInputsServiceInstance = new MockAudioInputsService();
    const audioManager = new AudioManager(mockOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsBrowser = mockAudioInputsBrowserInstance;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsService = mockAudioInputsServiceInstance;

    audioManager.startListening("test-token");

    expect(mockAudioInputsBrowserInstance.startListening).toHaveBeenCalled();
    expect(
      mockAudioInputsServiceInstance.startListening,
    ).not.toHaveBeenCalled();
  });

  test("inputServiceStartListening should call startListening on audioInputsService", () => {
    const mockOptions: AudioManagerOptions = {
      duckVolumeLevel: 0.2,
      normalVolumeLevel: 1,
      sttService: "charisma/deepgram",
      streamTimeslice: 100,
      handleError: jest.fn(),
      handleStartSTT: jest.fn(),
      handleStopSTT: jest.fn(),
      handleTranscript: jest.fn(),
    };

    const mockAudioInputsBrowserInstance = new MockAudioInputsBrowser();
    const mockAudioInputsServiceInstance = new MockAudioInputsService();
    const audioManager = new AudioManager(mockOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsBrowser = mockAudioInputsBrowserInstance;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsService = mockAudioInputsServiceInstance;

    audioManager.startListening("test-token");

    expect(mockAudioInputsServiceInstance.startListening).toHaveBeenCalled();
    expect(
      mockAudioInputsBrowserInstance.startListening,
    ).not.toHaveBeenCalled();
  });
});
