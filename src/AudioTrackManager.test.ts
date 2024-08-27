/* eslint-disable dot-notation */
import AudioTrackManager from "./AudioTrackManager";
import { AudioTrackBehaviour } from "./types";

globalThis.AudioContext = jest.fn().mockImplementation(() => {
  const gainNodeMock = {
    gain: { value: 1 },
    connect: jest.fn().mockReturnThis(), // return `this` to allow chaining
  };

  const bufferSourceMock = {
    buffer: null,
    loop: false,
    connect: jest.fn().mockReturnValue(gainNodeMock), // Mock to allow chaining
    start: jest.fn(),
    stop: jest.fn(),
    onended: jest.fn(),
  };

  return {
    createGain: jest.fn().mockReturnValue(gainNodeMock),
    createBufferSource: jest.fn().mockReturnValue(bufferSourceMock),
    decodeAudioData: jest.fn().mockImplementation(() =>
      Promise.resolve({
        duration: 120,
        sampleRate: 44100,
        length: 5292000,
        numberOfChannels: 2,
        getChannelData: jest.fn(),
      }),
    ),
    destination: {
      connect: jest.fn(), // Mock connect on the destination as well
    },
  };
});

globalThis.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    url: "",
    redirected: false,
    type: "basic",
    body: null,
    bodyUsed: false,
    clone: jest.fn(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    json: jest.fn(),
    text: jest.fn(),
    formData: jest.fn(),
    blob: jest.fn(),
  } as unknown as Response),
);

describe("AudioTrackManager", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize with isPlaying as false and no currentAudio", () => {
    const audioTrackManager = new AudioTrackManager();

    expect(audioTrackManager.isPlaying).toBe(false);
    expect(audioTrackManager["currentAudio"]).toEqual([]);
  });

  test("should play new audio tracks", async () => {
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

    await audioTrackManager.play(audioTracks);

    expect(audioTrackManager.isPlaying).toBe(true);
    expect(audioTrackManager["currentAudio"]).toHaveLength(2);
  });

  test("should not play audio if audioTracks array is empty", () => {
    const audioTrackManager = new AudioTrackManager();

    audioTrackManager.play([]);

    expect(audioTrackManager.isPlaying).toBe(false);
  });

  test("should stop all currently playing audio tracks", async () => {
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

    await audioTrackManager.play(audioTracks);
    audioTrackManager.stopAll();

    expect(audioTrackManager.isPlaying).toBe(false);
    expect(audioTrackManager["currentAudio"]).toEqual([]);
  });

  test("should toggle mute on all currently playing audio tracks", async () => {
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

    await audioTrackManager.play(audioTracks);

    audioTrackManager.toggleMute();
    expect(audioTrackManager["currentAudio"][0].gainNode.gain.value).toBe(0);

    audioTrackManager.toggleMute();
    expect(audioTrackManager["currentAudio"][0].gainNode.gain.value).toBe(1);
  });

  test("should set the volume for all currently playing audio tracks", async () => {
    const audioTrackManager = new AudioTrackManager();
    const audioTracks = [
      {
        url: "track2.mp3",
        loop: true,
        volume: 0.8,
        behaviour: AudioTrackBehaviour.Continue,
        stopPlaying: false,
      },
    ];

    await audioTrackManager.play(audioTracks);

    audioTrackManager.setVolume(0.5);

    expect(audioTrackManager["currentAudio"][0].gainNode.gain.value).toBe(0.4);

    audioTrackManager.setVolume(0.25);

    expect(audioTrackManager["currentAudio"][0].gainNode.gain.value).toBe(0.2);

    audioTrackManager.setVolume(1);

    expect(audioTrackManager["currentAudio"][0].gainNode.gain.value).toBe(0.8);
  });

  test("should restart an audio track when behaviour is set to 'restart'", async () => {
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

    await audioTrackManager.play(audioTracks);

    // Play the same track again, triggering the restart behavior
    audioTrackManager.play([audioTracks[0]]);

    expect(audioTrackManager["currentAudio"]).toHaveLength(1);
  });
});
