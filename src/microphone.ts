import EventEmitter from "eventemitter3";

interface Constructable<T> {
  new (): T;
}

interface IWindow extends Window {
  SpeechRecognition?: Constructable<SpeechRecognition>;
  webkitSpeechRecognition?: Constructable<SpeechRecognition>;
}

declare const window: IWindow;

type MicrophoneEvents = "recognise" | "recognise-interim";

class Microphone extends EventEmitter<MicrophoneEvents> {
  private stream: SpeechRecognition | undefined;

  private createStream = (): SpeechRecognition => {
    if (this.stream) {
      return this.stream;
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      throw new Error("SpeechRecognition isn't supported in this browser.");
    }

    const stream = new SpeechRecognitionClass();
    stream.continuous = false;
    stream.interimResults = true;
    stream.lang = "en-GB";
    this.stream = stream;
    return stream;
  };

  public startListening(): void {
    const stream = this.createStream();

    stream.onresult = this.onStreamResult;
    stream.onend = (): void => stream.start();
    try {
      stream.start();
    } catch (err) {
      // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
    }
  }

  public stopListening(): void {
    const { stream } = this;
    if (stream) {
      stream.onresult = (): void => {};
      stream.onend = (): void => {};
      try {
        stream.abort();
      } catch (err) {
        // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
      }
    }
  }

  private onStreamResult = (event: SpeechRecognitionEvent): void => {
    if (event.results && event.results[0] && event.results[0][0]) {
      const message = event.results[0][0].transcript.trim();
      if (event.results[0].isFinal === false) {
        this.emit("recognise-interim", message);
      } else {
        this.emit("recognise", message);
      }
    }
  };
}

export default Microphone;
