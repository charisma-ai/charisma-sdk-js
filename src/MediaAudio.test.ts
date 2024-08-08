declare let global: any;

type MediaAudioType = {
  originalVolume: number;
  url: string;
  setVolume: (volume: number) => void;
  volume: number;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(),
  pause: jest.fn(),
}));

const MediaAudio = (await import("./MediaAudio")).default;

describe("MediaAudio", () => {
  let mediaAudio: MediaAudioType;

  beforeEach(() => {
    mediaAudio = new MediaAudio("http://example.com/test.mp3");
  });

  it("should be an instance of Audio", () => {
    expect(mediaAudio).toBeInstanceOf(MediaAudio);
  });

  it("should initialize with the given URL", () => {
    expect(mediaAudio.url).toBe("http://example.com/test.mp3");
  });

  it("should set originalVolume to the initial volume", () => {
    expect(mediaAudio.originalVolume).toBe(1.0);
  });

  it("should set the correct volume relative to the originalVolume", () => {
    mediaAudio.setVolume(0.5);
    expect(mediaAudio.volume).toBe(0.5);

    mediaAudio.setVolume(2.0);
    expect(mediaAudio.volume).toBe(2.0);
  });

  it("should not affect originalVolume when setting volume", () => {
    mediaAudio.setVolume(0.5);
    expect(mediaAudio.originalVolume).toBe(1.0);

    mediaAudio.setVolume(2.0);
    expect(mediaAudio.originalVolume).toBe(1.0);
  });

  it("should allow setting volume to 0", () => {
    mediaAudio.setVolume(0);
    expect(mediaAudio.volume).toBe(0);
  });
});
export {};
