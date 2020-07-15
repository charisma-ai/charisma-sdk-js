import EventEmitter from "eventemitter3";

interface Constructable<T> {
  new (): T;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: Constructable<SpeechRecognition>;
  webkitSpeechRecognition?: Constructable<SpeechRecognition>;
}

declare const window: WindowWithSpeechRecognition;

const SpeechRecognitionClass =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

export interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  timeout?: number;
}

export type SpeechRecognitionErrorCode =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported";

type MicrophoneEvents = {
  recognise: [string];
  "recognise-interim": [string];
  error: [SpeechRecognitionErrorCode];
  timeout: [];
  start: [];
  stop: [];
};

class Microphone extends EventEmitter<MicrophoneEvents> {
  private recognition = SpeechRecognitionClass
    ? new SpeechRecognitionClass()
    : undefined;

  private timeoutId: number | undefined;

  public isSupported = SpeechRecognitionClass !== undefined;

  public startListening = ({
    continuous = false,
    interimResults = true,
    lang = "en-GB",
    timeout,
  }: SpeechRecognitionOptions = {}): void => {
    if (!this.recognition) {
      return;
    }

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    const { recognition } = this;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.onresult = this.onRecognitionResult;
    recognition.onstart = (): void => {
      this.emit("start");
    };
    recognition.onend = (): void => {
      this.emit("stop");
      recognition.start();
    };
    recognition.onerror = (event): void => {
      this.emit(
        "error",
        ((event as unknown) as { error: SpeechRecognitionErrorCode }).error,
      );
    };

    try {
      recognition.start();
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

    const { recognition } = this;
    if (recognition) {
      recognition.onresult = (): void => undefined;
      recognition.onend = (): void => {
        this.emit("stop");
      };
      try {
        recognition.abort();
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

  private onRecognitionResult = (event: SpeechRecognitionEvent): void => {
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
