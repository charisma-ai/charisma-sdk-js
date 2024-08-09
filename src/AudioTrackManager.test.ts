/* eslint-disable dot-notation */
import MockMediaAudio from "./__mocks__/MockMediaAudio";

import AudioTrackManager from "./AudioTrackManager";
import { AudioTrackBehaviour } from "./types";

jest.mock("./MediaAudio", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => MockMediaAudio),
}));

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
  });

  test("should not play audio if audioTracks array is empty", () => {
    const audioTrackManager = new AudioTrackManager();

    audioTrackManager.play([]);

    expect(audioTrackManager.isPlaying).toBe(false);
  });

  test("should stop all currently playing audio tracks", () => {
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
    expect(MockMediaAudio.pause).toHaveBeenCalledTimes(2);
  });

  test("should toggle mute on all currently playing audio tracks", () => {
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
  });

  test("should set the volume for all currently playing audio tracks", () => {
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
    audioTrackManager.setVolume(0.3);

    expect(audioTrackManager["currentAudio"][0].volume).toBe(0.3);
    expect(audioTrackManager["currentAudio"][1].volume).toBe(0.3);

    audioTrackManager.setVolume(0.7);

    expect(audioTrackManager["currentAudio"][0].volume).toBe(0.7);
    expect(audioTrackManager["currentAudio"][1].volume).toBe(0.7);
  });

  test("should restart an audio track when behaviour is set to 'restart'", () => {
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

    expect(MockMediaAudio.fastSeek).toHaveBeenCalledTimes(3);
  });
});
