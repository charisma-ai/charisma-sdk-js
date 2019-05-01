interface Constructable<T> {
  new (): T;
}

interface IWindow extends Window {
  AudioContext?: Constructable<AudioContext>;
  webkitAudioContext?: Constructable<AudioContext>;
}

declare const window: IWindow;

class Speaker {
  private audioContext: AudioContext | undefined;

  private getAudioContext(): AudioContext {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AudioContext isn't supported in this browser.");
    }

    const audioContext = new AudioContext();
    this.audioContext = audioContext;
    return audioContext;
  }

  public async play(audio: number[]): Promise<void> {
    const audioContext = this.getAudioContext();
    const arrayBuffer = new Uint8Array(audio).buffer;
    const source = audioContext.createBufferSource();
    source.connect(audioContext.destination);
    source.buffer = await new Promise(
      (resolve, reject): void => {
        audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      }
    );
    return new Promise(
      (resolve): void => {
        source.onended = (): void => resolve();
        source.start();
      }
    );
  }
}

export default Speaker;
