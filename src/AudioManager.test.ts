import MediaAudio from "./MediaAudio";
import AudioManager, { AudioManagerOptions } from "./AudioManager";
import { AudioOutputsServicePlayOptions } from "./AudioOutputsService";

jest.mock("./MediaAudio", () => {
  return jest.fn().mockImplementation(() => {
    let volume = 1;
    return {
      isPlaying: false,
      get volume() {
        return volume;
      },
      set volume(newVolume) {
        volume = newVolume;
      },
      play: jest.fn(),
      pause: jest.fn(),
      fastSeek: jest.fn(),
    };
  });
});

jest.mock("./AudioInputsService", () => {
  return jest.fn().mockImplementation(() => {
    return {
      startListening: jest.fn(),
      stopListening: jest.fn(),
      connect: jest.fn(),
      resetTimeout: jest.fn(),
    };
  });
});

jest.mock("./AudioOutputsService", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getAudioContext: jest.fn(),
      play: jest.fn(),
    };
  });
});

jest.mock("./BrowserSttService", () => {
  return jest.fn().mockImplementation(() => {
    return {
      isSupported: true,
      startListening: jest.fn(),
      stopListening: jest.fn(),
      resetTimeout: jest.fn(),
    };
  });
});

describe("AudioManager", () => {
  let audioManager: AudioManager;
  let mockOptions: AudioManagerOptions;
  let mockMediaAudioInstance: MediaAudio;

  beforeEach(() => {
    mockOptions = {
      duckVolumeLevel: 0.2,
      normalVolumeLevel: 1,
      sttService: "browser",
      streamTimeslice: 100,
    };

    // Create a new instance of AudioManager
    audioManager = new AudioManager(mockOptions);

    // Retrieve the instance of MediaAudio
    // eslint-disable-next-line prefer-destructuring, @typescript-eslint/no-unsafe-assignment
    mockMediaAudioInstance = (MediaAudio as jest.Mock).mock.instances[0];
    mockMediaAudioInstance.isPlaying = true;
  });

  // Audio Input Service Tests
  test("inputServiceStartListening should call startListening and duck volume if media is playing", () => {
    audioManager.mediaAudio.isPlaying = true;
    audioManager.inputServiceStartListening();
    expect(audioManager.audioInputsService.startListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.duckVolumeLevel);
  });

  test("inputServiceStartListening should call startListening and not change volume if media is not playing", () => {
    audioManager.mediaAudio.isPlaying = false;
    audioManager.inputServiceStartListening();
    expect(audioManager.audioInputsService.startListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).not.toBe(
      mockOptions.duckVolumeLevel,
    );
  });

  test("inputServiceStopListening should call stopListening and set volume to normal if media is playing", () => {
    audioManager.mediaAudio.isPlaying = true;
    audioManager.inputServiceStopListening();
    expect(audioManager.audioInputsService.stopListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.normalVolumeLevel);
  });

  test("inputServiceStopListening should call stopListening and not change volume if media is not playing", () => {
    audioManager.mediaAudio.isPlaying = false;
    audioManager.inputServiceStopListening();
    expect(audioManager.audioInputsService.stopListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.normalVolumeLevel);
  });

  test("inputServiceConnect should call connect with the provided token", () => {
    const token = "testToken";
    audioManager.inputServiceConnect(token);
    expect(audioManager.audioInputsService.connect).toHaveBeenCalledWith(token);
  });

  test("inputServiceResetTimeout should call resetTimeout with the provided timeout", () => {
    const timeout = 5000;
    audioManager.inputServiceResetTimeout(timeout);
    expect(audioManager.audioInputsService.resetTimeout).toHaveBeenCalledWith(
      timeout,
    );
  });

  // Browser STT Service Tests
  test("browserIsSupported should return isSupported from BrowserSttService", () => {
    expect(audioManager.browserIsSupported()).toBe(
      audioManager.audioInputsBrowser.isSupported,
    );
  });

  test("browserStartListening should call startListening and duck volume if media is playing", () => {
    audioManager.mediaAudio.isPlaying = true;
    audioManager.browserStartListening();
    expect(audioManager.audioInputsBrowser.startListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.duckVolumeLevel);
  });

  test("browserStartListening should call startListening and not change volume if media is not playing", () => {
    audioManager.mediaAudio.isPlaying = false;
    audioManager.browserStartListening();
    expect(audioManager.audioInputsBrowser.startListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).not.toBe(
      mockOptions.duckVolumeLevel,
    );
  });

  test("browserStopListening should call stopListening and set volume to normal if media is playing", () => {
    audioManager.mediaAudio.isPlaying = true;
    audioManager.browserStopListening();
    expect(audioManager.audioInputsBrowser.stopListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.normalVolumeLevel);
  });

  test("browserStopListening should call stopListening and not change volume if media is not playing", () => {
    audioManager.mediaAudio.isPlaying = false;
    audioManager.browserStopListening();
    expect(audioManager.audioInputsBrowser.stopListening).toHaveBeenCalled();
    expect(audioManager.mediaAudio.volume).toBe(mockOptions.normalVolumeLevel);
  });

  test("browserResetTimeout should call resetTimeout with the provided timeout", () => {
    const timeout = 5000;
    audioManager.browserResetTimeout(timeout);
    expect(audioManager.audioInputsBrowser.resetTimeout).toHaveBeenCalledWith(
      timeout,
    );
  });

  // Audio Outputs Service Tests
  test("outputServiceGetAudioContext should return the audio context", () => {
    expect(audioManager.outputServiceGetAudioContext()).toBe(
      audioManager.audioOutputsService.getAudioContext(),
    );
  });

  test("outputServicePlay should call play with the provided audio and options", async () => {
    const audio = new ArrayBuffer(8);
    const options: AudioOutputsServicePlayOptions = { interrupt: "all" };
    await audioManager.outputServicePlay(audio, options);
    expect(audioManager.audioOutputsService.play).toHaveBeenCalledWith(
      audio,
      options,
    );
  });
});
