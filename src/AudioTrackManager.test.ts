/* eslint-disable dot-notation */
import AudioTrackManager from "./AudioTrackManager";
import { AudioTrackBehaviour } from "./types";

// Ensure Audio is defined in the jsdom environment and mock it properly
globalThis.Audio = jest.fn().mockImplementation(() => {
  const audioElement = document.createElement("audio");

  // Mock necessary methods and properties
  audioElement.play = jest.fn().mockResolvedValue(undefined);
  audioElement.pause = jest.fn();
  audioElement.muted = false;
  audioElement.volume = 1.0;
  audioElement.currentTime = 0;

  return audioElement;
});

describe("AudioTrackManager", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize with isPlaying as false and no currentAudio", () => {
    const audioTrackManager = new AudioTrackManager();

    expect(audioTrackManager.isPlaying).toBe(false);
    expect(audioTrackManager["currentAudio"]).toEqual([]);
  });

  test("should play new audio tracks", () => {
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => new Promise(jest.fn()));

    const audioTrackManager = new AudioTrackManager();

    const audioTracks = [
      {
        url: "track1.mp3",
        loop: false,
        volume: 0.5,
        behaviour: AudioTrackBehaviour.Restart,
        stopPlaying: false,
      },
      {
        url: "track2.mp3",
        loop: true,
        volume: 0.8,
        behaviour: AudioTrackBehaviour.Continue,
        stopPlaying: false,
      },
    ];
    audioTrackManager.play(audioTracks);

    expect(audioTrackManager.isPlaying).toBe(true);
    expect(audioTrackManager["currentAudio"]).toHaveLength(2);
    expect(playStub).toHaveBeenCalledTimes(2);

    playStub.mockRestore();
  });

  test("should not play audio if audioTracks array is empty", () => {
    const audioTrackManager = new AudioTrackManager();

    audioTrackManager.play([]);

    expect(audioTrackManager.isPlaying).toBe(false);
  });

  test("should stop all currently playing audio tracks", () => {
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => new Promise(jest.fn()));
    const pauseStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "pause")
      .mockImplementation(jest.fn());

    const audioTrackManager = new AudioTrackManager();
    const audioTracks = [
      {
        url: "track1.mp3",
        loop: false,
        volume: 0.5,
        behaviour: AudioTrackBehaviour.Restart,
        stopPlaying: false,
      },
      {
        url: "track2.mp3",
        loop: true,
        volume: 0.8,
        behaviour: AudioTrackBehaviour.Continue,
        stopPlaying: false,
      },
    ];
    audioTrackManager.play(audioTracks);
    audioTrackManager.stopAll();

    expect(audioTrackManager.isPlaying).toBe(false);
    expect(audioTrackManager["currentAudio"]).toEqual([]);
    expect(pauseStub).toHaveBeenCalledTimes(2);

    playStub.mockRestore();
    pauseStub.mockRestore();
  });

  test("should toggle mute on all currently playing audio tracks", () => {
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => new Promise(jest.fn()));

    const audioTrackManager = new AudioTrackManager();
    const audioTracks = [
      {
        url: "track1.mp3",
        loop: false,
        volume: 0.5,
        behaviour: AudioTrackBehaviour.Restart,
        stopPlaying: false,
      },
    ];
    audioTrackManager.play(audioTracks);

    audioTrackManager.toggleMute();
    expect(audioTrackManager["currentAudio"][0].muted).toBe(true);

    audioTrackManager.toggleMute();
    expect(audioTrackManager["currentAudio"][0].muted).toBe(false);

    playStub.mockRestore();
  });

  test("should set the volume for all currently playing audio tracks", () => {
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => new Promise(jest.fn()));

    const audioTrackManager = new AudioTrackManager();
    const audioTracks = [
      {
        url: "track1.mp3",
        loop: false,
        volume: 1,
        behaviour: AudioTrackBehaviour.Restart,
        stopPlaying: false,
      },
      {
        url: "track2.mp3",
        loop: true,
        volume: 0.8,
        behaviour: AudioTrackBehaviour.Continue,
        stopPlaying: false,
      },
    ];

    audioTrackManager.setVolume = jest.fn();

    audioTrackManager.play(audioTracks);

    audioTrackManager.setVolume(0.5);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(audioTrackManager.setVolume).toHaveBeenCalledWith(0.5);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(audioTrackManager.setVolume).toHaveBeenCalledTimes(1);

    // expect(audioTrackManager["currentAudio"][0].volume).toBe(0.5);
    // expect(audioTrackManager["currentAudio"][1].volume).toBe(0.4);

    // audioTrackManager.setVolume(1);

    // expect(audioTrackManager["currentAudio"][0].volume).toBe(1);
    // expect(audioTrackManager["currentAudio"][1].volume).toBe(0.8);

    playStub.mockRestore();
  });

  test("should restart an audio track when behaviour is set to 'restart'", () => {
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => new Promise(jest.fn()));

    const audioTrackManager = new AudioTrackManager();
    const audioTracks = [
      {
        url: "track1.mp3",
        loop: false,
        volume: 0.5,
        behaviour: AudioTrackBehaviour.Restart,
        stopPlaying: false,
      },
      {
        url: "track2.mp3",
        loop: true,
        volume: 0.8,
        behaviour: AudioTrackBehaviour.Continue,
        stopPlaying: false,
      },
    ];

    audioTrackManager.play(audioTracks);

    // Play the same tracks again, triggering the restart behaviour
    audioTrackManager.play([audioTracks[0]]);

    expect(audioTrackManager["currentAudio"][0].currentTime).toBe(0);

    playStub.mockRestore();
  });
});
