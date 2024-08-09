import MediaAudio from "./MediaAudio";

describe("MediaAudio", () => {
  test("setVolume should set to the correct volume", () => {
    const mediaAudio = new MediaAudio("test.mp3");

    mediaAudio.volume = 1;
    mediaAudio.originalVolume = 0.8;

    mediaAudio.setVolume(0.5);

    expect(mediaAudio.volume).toBe(0.4);
  });
});
