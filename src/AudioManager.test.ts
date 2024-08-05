/* eslint-disable dot-notation */
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
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialise with default options", () => {
    const defaultOptions: AudioManagerOptions = {};
    const audioManager = new AudioManager(defaultOptions);

    expect(audioManager["duckVolumeLevel"]).toBe(0);
    expect(audioManager["normalVolumeLevel"]).toBe(1);
    expect(audioManager["sttService"]).toBe("charisma/deepgram");
  });

  test("should initialise with provided options", () => {
    const mockOptions: AudioManagerOptions = {
      duckVolumeLevel: 0.2,
      normalVolumeLevel: 2,
      sttService: "browser",
    };

    const audioManager = new AudioManager(mockOptions);

    expect(audioManager["duckVolumeLevel"]).toBe(0.2);
    expect(audioManager["normalVolumeLevel"]).toBe(2);
    expect(audioManager["sttService"]).toBe("browser");
  });

  test("microphone methods should call on audioInputsBrowser when browser is used", () => {
    const mockOptions: AudioManagerOptions = {
      sttService: "browser",
    };

    const mockAudioInputsBrowserInstance = new MockAudioInputsBrowser();
    const mockAudioInputsServiceInstance = new MockAudioInputsService();
    const audioManager = new AudioManager(mockOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsBrowser = mockAudioInputsBrowserInstance;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsService = mockAudioInputsServiceInstance;

    audioManager.startListening();
    audioManager.stopListening();
    audioManager.resetTimeout(100);

    expect(mockAudioInputsBrowserInstance.startListening).toHaveBeenCalled();
    expect(mockAudioInputsBrowserInstance.stopListening).toHaveBeenCalled();
    expect(mockAudioInputsBrowserInstance.resetTimeout).toHaveBeenCalledWith(
      100,
    );

    expect(
      mockAudioInputsServiceInstance.startListening,
    ).not.toHaveBeenCalled();
    expect(mockAudioInputsServiceInstance.stopListening).not.toHaveBeenCalled();
    expect(mockAudioInputsServiceInstance.resetTimeout).not.toHaveBeenCalled();
  });

  test("inputServiceStartListening should call startListening on audioInputsService", () => {
    const mockOptions: AudioManagerOptions = {
      sttService: "charisma/deepgram",
    };

    const mockAudioInputsBrowserInstance = new MockAudioInputsBrowser();
    const mockAudioInputsServiceInstance = new MockAudioInputsService();
    const audioManager = new AudioManager(mockOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsBrowser = mockAudioInputsBrowserInstance;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsService = mockAudioInputsServiceInstance;

    audioManager.startListening();
    audioManager.stopListening();
    audioManager.resetTimeout(100);
    audioManager.connect("token");

    expect(mockAudioInputsServiceInstance.startListening).toHaveBeenCalled();
    expect(mockAudioInputsServiceInstance.stopListening).toHaveBeenCalled();
    expect(mockAudioInputsServiceInstance.connect).toHaveBeenCalled();
    expect(mockAudioInputsServiceInstance.resetTimeout).toHaveBeenCalledWith(
      100,
    );

    expect(
      mockAudioInputsBrowserInstance.startListening,
    ).not.toHaveBeenCalled();
    expect(mockAudioInputsBrowserInstance.stopListening).not.toHaveBeenCalled();
    expect(mockAudioInputsBrowserInstance.resetTimeout).not.toHaveBeenCalled();
  });

  test("connect should call AudioInputsService.connect with the correct token", () => {
    const mockAudioInputsServiceInstance = new MockAudioInputsService();
    const audioManager = new AudioManager({});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsService = mockAudioInputsServiceInstance;

    const token = "test-token";

    audioManager.connect(token);

    expect(mockAudioInputsServiceInstance.connect).toHaveBeenCalledWith(token);
  });

  test("browserIsSupported should return the value from AudioInputsBrowser", () => {
    const mockOptions: AudioManagerOptions = {
      sttService: "browser",
    };

    const mockAudioInputsBrowserInstance = new MockAudioInputsBrowser();
    const audioManager = new AudioManager(mockOptions);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (audioManager as any).audioInputsBrowser = mockAudioInputsBrowserInstance;

    mockAudioInputsBrowserInstance.isSupported = false;

    expect(audioManager.browserIsSupported()).toBe(false);
  });
});
