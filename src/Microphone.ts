import EventEmitter from "eventemitter3";

interface Constructable<T> {
  new (): T;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: Constructable<SpeechRecognition>;
  webkitSpeechRecognition?: Constructable<SpeechRecognition>;
}

declare const window: WindowWithSpeechRecognition;

type MicrophoneEvents =
  | "recognise"
  | "recognise-interim"
  | "timeout"
  | "start"
  | "stop";

declare interface Microphone {
  on(event: "recognise", listener: (result: string) => void): this;
  on(event: "recognise-interim", listener: (result: string) => void): this;
  on(event: "timeout", listener: () => void): this;
  on(event: "start", listener: () => void): this;
  on(event: "stop", listener: () => void): this;
}

class Microphone extends EventEmitter<MicrophoneEvents> {
  private stream: SpeechRecognition | undefined;

  private timeoutId: number | undefined;

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

  public startListening = (timeout?: number): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    const stream = this.createStream();

    stream.onresult = this.onStreamResult;
    stream.onend = (): void => stream.start();
    try {
      this.emit("start");
      stream.start();
    } catch (err) {
      // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
    }

    if (timeout !== undefined) {
      this.timeoutId = window.setTimeout(this.onTimeout, timeout);
    }
  };

  public stopListening = (): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    const { stream } = this;
    if (stream) {
      stream.onresult = (): void => {};
      stream.onend = (): void => {};
      try {
        this.emit("stop");
        stream.abort();
      } catch (err) {
        // this is fine, it just means we tried to start/stop a stream when it was already started/stopped
      }
    }
  };

  public resetTimeout = (timeout: number): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(this.onTimeout, timeout);
  };

  private onTimeout = (): void => {
    this.timeoutId = undefined;
    this.emit("timeout");
    this.stopListening();
  };

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
