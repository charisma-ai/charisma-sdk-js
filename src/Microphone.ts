import EventEmitter from "eventemitter3";

import type {
  SpeechRecognition,
  SpeechRecognitionErrorCode,
  SpeechRecognitionEvent,
} from "./speech-types.js";

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

export interface SpeechRecognitionStopOptions {
  waitForLastResult?: boolean;
}

type MicrophoneEvents = {
  result: [SpeechRecognitionEvent];
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
      this.emit("error", event.error);
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

  public stopListening = ({
    waitForLastResult = false,
  }: SpeechRecognitionStopOptions = {}): void => {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    const { recognition } = this;
    if (recognition) {
      if (!waitForLastResult) {
        recognition.onresult = (): void => undefined;
      }
      recognition.onend = (): void => {
        this.emit("stop");
      };
      try {
        if (waitForLastResult) {
          recognition.stop();
        } else {
          recognition.abort();
        }
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
    this.emit("result", event);

    if (event.results.length === 0) {
      return;
    }

    const lastResult = event.results[event.results.length - 1];
    const message = lastResult[0].transcript.trim();
    if (lastResult.isFinal) {
      this.emit("recognise", message);
    } else {
      this.emit("recognise-interim", message);
    }
  };
}

export default Microphone;
