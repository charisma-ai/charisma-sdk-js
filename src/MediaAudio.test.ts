import MediaAudio from "./MediaAudio";

// Ensure Audio is defined in the jsdom environment and mock it properly
globalThis.Audio = jest.fn().mockImplementation(() => {
  const audioElement = document.createElement("audio");

  // Mock necessary methods and properties
  audioElement.play = jest.fn().mockResolvedValue(undefined);
  audioElement.pause = jest.fn();
  audioElement.muted = false;
  audioElement.volume = 1.0;
  audioElement.currentTime = 0;
  // @ts-ignore
  audioElement.setVolume = jest.fn();

  return audioElement;
});

describe("MediaAudio", () => {
  test("setVolume should set to the correct volume", () => {
    const mediaAudio = new MediaAudio("test.mp3");

    mediaAudio.volume = 1;
    mediaAudio.originalVolume = 0.8;

    mediaAudio.setVolume(0.5);

    expect(mediaAudio.volume).toBe(0.4);
  });
});
